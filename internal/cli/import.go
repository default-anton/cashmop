package cli

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"

	"github.com/default-anton/cashmop/internal/cashmop"
	"github.com/default-anton/cashmop/internal/database"
	"github.com/default-anton/cashmop/internal/mapping"
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

func handleImport(svc *cashmop.Service, args []string) commandResult {
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

	mappingData, mErr := resolveMapping(svc, mappingSpec)
	if mErr != nil {
		return commandResult{Err: mErr}
	}
	var m mapping.ImportMapping
	if err := json.Unmarshal(mappingData, &m); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Field: "mapping", Message: "Invalid mapping JSON schema.", Hint: "Ensure the mapping JSON matches the import schema."})}
	}

	parsed, err := parseFileForImport(filePath)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	monthsMap := computeMonths(parsed.headers, parsed.rows, m)
	allMonths := make([]string, 0, len(monthsMap))
	for month := range monthsMap {
		allMonths = append(allMonths, month)
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

	txs, err := normalizeTransactions(svc, parsed, m, finalMonths)
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

	inserted, skipped, err := svc.BatchInsertTransactionsWithCount(txs)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	appliedCount := 0
	if !noApplyRules {
		if count, err := svc.ApplyAllRules(); err == nil {
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

func resolveMapping(svc *cashmop.Service, spec string) ([]byte, *cliError) {
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

	m, err := svc.GetColumnMappingByName(spec)
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

func computeMonths(headers []string, rows [][]string, mapping mapping.ImportMapping) map[string]int {
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

func normalizeTransactions(svc *cashmop.Service, parsed *parsedFile, mapping mapping.ImportMapping, selectedMonths []string) ([]database.TransactionModel, error) {
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

	accountIdx := findHeader(headers, mapping.CSV.Account)
	currencyIdx := findHeader(headers, mapping.CSV.Currency)

	settings, _ := svc.GetCurrencySettings()
	defaultCurrency := strings.ToUpper(strings.TrimSpace(settings.MainCurrency))
	if defaultCurrency == "" {
		defaultCurrency = database.DefaultCurrency()
	}

	accountMap, err := svc.GetAccountMap()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch accounts: %w", err)
	}
	userMap, err := svc.GetUserMap()
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

		account := strings.TrimSpace(mapping.Account)
		if accountIdx != -1 && accountIdx < len(row) {
			if v := strings.TrimSpace(row[accountIdx]); v != "" {
				account = v
			}
		}
		if account == "" {
			account = "Unknown"
		}

		accID, ok := accountMap[account]
		if !ok {
			id, err := svc.CreateAccount(account)
			if err != nil {
				return nil, err
			}
			accID = id
			accountMap[account] = accID
		}

		var ownerID *int64
		owner := strings.TrimSpace(mapping.Owner)
		if owner != "" {
			if id, ok := userMap[owner]; ok {
				v := id
				ownerID = &v
			} else {
				puid, err := svc.CreateOwner(owner)
				if err != nil {
					return nil, err
				}
				if puid != nil {
					ownerID = puid
					userMap[owner] = *puid
				}
			}
		}

		out = append(out, database.TransactionModel{
			AccountID:   accID,
			OwnerID:     ownerID,
			Date:        d.Format("2006-01-02"),
			Description: description,
			Amount:      amount,
			CategoryID:  nil,
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
