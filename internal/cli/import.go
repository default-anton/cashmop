package cli

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"

	"github.com/default-anton/cashmop/internal/database"
)

type importResponse struct {
	Ok            bool     `json:"ok"`
	ImportedCount int      `json:"imported_count"`
	SkippedCount  int      `json:"skipped_count"`
	Months        []string `json:"months"`
	AppliedRules  bool     `json:"applied_rules"`
	AppliedCount  int      `json:"applied_count"`
}

type importDryRunResponse struct {
	Ok          bool     `json:"ok"`
	DryRun      bool     `json:"dry_run"`
	ParsedCount int      `json:"parsed_count"`
	Months      []string `json:"months"`
	Warnings    []string `json:"warnings"`
}

func handleImport(args []string) commandResult {
	fs := newSubcommandFlagSet("import")
	var filePath string
	var mappingSpec string
	var selectedMonths stringSliceFlag
	var dryRun bool
	var noApplyRules bool

	fs.StringVar(&filePath, "file", "", "")
	fs.StringVar(&mappingSpec, "mapping", "", "")
	fs.Var(&selectedMonths, "month", "")
	fs.BoolVar(&dryRun, "dry-run", false, "")
	fs.BoolVar(&noApplyRules, "no-apply-rules", false, "")

	if ok, res := fs.parse(args, "import"); !ok {
		return res
	}

	if filePath == "" || mappingSpec == "" {
		var details []ErrorDetail
		if filePath == "" {
			details = append(details, requiredFlagError("file", "Provide --file <path>."))
		}
		if mappingSpec == "" {
			details = append(details, requiredFlagError("mapping", "Provide --mapping <path|name|->."))
		}
		return commandResult{Err: validationError(details...)}
	}

	// 1. Resolve mapping
	mappingData, mErr := resolveMapping(mappingSpec)
	if mErr != nil {
		return commandResult{Err: mErr}
	}
	var mapping database.ImportMapping
	if err := json.Unmarshal(mappingData, &mapping); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Field: "mapping", Message: "Invalid mapping JSON schema.", Hint: "Ensure the mapping JSON matches the import schema."})}
	}

	// 2. Parse file
	parsed, err := parseFileForImport(filePath)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	// 3. Extract months and validate month selection
	monthsMap := computeMonths(parsed.headers, parsed.rows, mapping)
	allMonths := make([]string, 0, len(monthsMap))
	for m := range monthsMap {
		allMonths = append(allMonths, m)
	}
	sort.Strings(allMonths)

	finalMonths := selectedMonths.values
	if len(finalMonths) == 0 {
		if len(allMonths) == 1 {
			finalMonths = allMonths
		} else if len(allMonths) > 1 {
			return commandResult{Err: validationError(ErrorDetail{
				Field:   "month",
				Message: fmt.Sprintf("File contains multiple months (%s).", strings.Join(allMonths, ", ")),
				Hint:    "Repeat --month to select which months to import.",
			})}
		} else {
			return commandResult{Err: runtimeError(ErrorDetail{Message: "No valid transaction dates found in the file."})}
		}
	}

	// 4. Normalize transactions for selected months
	txs, err := normalizeTransactions(parsed, mapping, finalMonths)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	if dryRun {
		return commandResult{Response: importDryRunResponse{
			Ok:          true,
			DryRun:      true,
			ParsedCount: len(txs),
			Months:      allMonths,
			Warnings:    []string{},
		}}
	}

	// 5. Insert
	inserted, skipped, err := database.BatchInsertTransactionsWithCount(txs)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	// 6. Rules
	appliedCount := 0
	if !noApplyRules {
		if count, err := database.ApplyAllRules(); err == nil {
			appliedCount = count
		}
	}

	return commandResult{Response: importResponse{
		Ok:            true,
		ImportedCount: inserted,
		SkippedCount:  skipped,
		Months:        finalMonths,
		AppliedRules:  appliedCount > 0,
		AppliedCount:  appliedCount,
	}}
}

func resolveMapping(spec string) ([]byte, *cliError) {
	if spec == "-" {
		data, err := io.ReadAll(os.Stdin)
		if err != nil {
			return nil, runtimeError(ErrorDetail{Message: "failed to read mapping from stdin"})
		}
		return data, nil
	}

	if _, err := os.Stat(spec); err == nil {
		data, err := os.ReadFile(spec)
		if err != nil {
			return nil, runtimeError(ErrorDetail{Message: fmt.Sprintf("failed to read mapping file: %v", err)})
		}
		return data, nil
	}

	// Try DB mapping name
	m, err := database.GetColumnMappingByName(spec)
	if err != nil {
		return nil, runtimeError(ErrorDetail{Message: err.Error()})
	}
	if m == nil {
		return nil, validationError(ErrorDetail{
			Field:   "mapping",
			Message: fmt.Sprintf("Mapping '%s' not found as a file or saved mapping name.", spec),
			Hint:    "Check the file path or list saved mappings with 'cashmop mappings list'.",
		})
	}
	return []byte(m.MappingJSON), nil
}

func computeMonths(headers []string, rows [][]string, mapping database.ImportMapping) map[string]int {
	dateIdx := -1
	for i, h := range headers {
		if h == mapping.CSV.Date {
			dateIdx = i
			break
		}
	}
	if dateIdx == -1 {
		return nil
	}

	buckets := make(map[string]int)
	for _, row := range rows {
		if dateIdx >= len(row) {
			continue
		}
		d := parseDateLoose(row[dateIdx])
		if d.IsZero() {
			continue
		}
		key := d.Format("2006-01")
		buckets[key]++
	}
	return buckets
}

func normalizeTransactions(parsed *parsedFile, mapping database.ImportMapping, selectedMonths []string) ([]database.TransactionModel, error) {
	monthSet := make(map[string]bool)
	for _, m := range selectedMonths {
		monthSet[m] = true
	}

	headers := parsed.headers
	dateIdx := findHeader(headers, mapping.CSV.Date)
	var descIdxs []int
	for _, d := range mapping.CSV.Description {
		if i := findHeader(headers, d); i != -1 {
			descIdxs = append(descIdxs, i)
		}
	}

	amountParser := createAmountParser(mapping, headers)

	ownerIdx := findHeader(headers, mapping.CSV.Owner)
	accountIdx := findHeader(headers, mapping.CSV.Account)
	currencyIdx := findHeader(headers, mapping.CSV.Currency)

	settings, _ := database.GetCurrencySettings()
	defaultCurrency := strings.ToUpper(strings.TrimSpace(settings.MainCurrency))
	if defaultCurrency == "" {
		defaultCurrency = database.DefaultCurrency()
	}

	accountMap, err := database.GetAccountMap()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch accounts: %w", err)
	}
	userMap, err := database.GetUserMap()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch users: %w", err)
	}

	var out []database.TransactionModel
	for _, row := range parsed.rows {
		if dateIdx == -1 || dateIdx >= len(row) {
			continue
		}
		d := parseDateLoose(row[dateIdx])
		if d.IsZero() {
			continue
		}

		if !monthSet[d.Format("2006-01")] {
			continue
		}

		descParts := make([]string, 0, len(descIdxs))
		for _, i := range descIdxs {
			if i < len(row) && row[i] != "" {
				descParts = append(descParts, row[i])
			}
		}
		description := strings.Join(descParts, " ")

		amount := amountParser(row)

		currency := ""
		if currencyIdx != -1 && currencyIdx < len(row) {
			currency = strings.ToUpper(strings.TrimSpace(row[currencyIdx]))
		}
		if currency == "" {
			currency = strings.ToUpper(strings.TrimSpace(mapping.CurrencyDefault))
		}
		if currency == "" {
			currency = defaultCurrency
		}

		account := mapping.Account
		if accountIdx != -1 && accountIdx < len(row) && row[accountIdx] != "" {
			account = row[accountIdx]
		}

		owner := mapping.DefaultOwner
		if owner == "" {
			owner = "Unassigned"
		}
		if ownerIdx != -1 && ownerIdx < len(row) && row[ownerIdx] != "" {
			owner = row[ownerIdx]
		}

		accID, ok := accountMap[account]
		if !ok {
			id, err := database.GetOrCreateAccount(account)
			if err != nil {
				return nil, fmt.Errorf("failed to get/create account '%s': %w", account, err)
			}
			accID = id
			accountMap[account] = accID
		}

		var ownerID *int64
		if owner != "" {
			uid, ok := userMap[owner]
			if !ok {
				puid, err := database.GetOrCreateUser(owner)
				if err != nil {
					return nil, fmt.Errorf("failed to get/create user '%s': %w", owner, err)
				}
				if puid != nil {
					uid = *puid
					userMap[owner] = uid
					idCopy := uid
					ownerID = &idCopy
				}
			} else {
				idCopy := uid
				ownerID = &idCopy
			}
		}

		out = append(out, database.TransactionModel{
			AccountID:   accID,
			OwnerID:     ownerID,
			Date:        d.Format("2006-01-02"),
			Description: description,
			Amount:      amount,
			Currency:    currency,
		})
	}
	return out, nil
}

func findHeader(headers []string, name string) int {
	if name == "" {
		return -1
	}
	for i, h := range headers {
		if h == name {
			return i
		}
	}
	return -1
}
