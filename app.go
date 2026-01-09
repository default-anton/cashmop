package main

import (
	"cashflow/internal/brave"
	"cashflow/internal/database"
	"cashflow/internal/fuzzy"
	"cashflow/internal/fx"
	"cashflow/internal/version"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	osexec "os/exec"
	"path/filepath"
	stdlibRuntime "runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"github.com/xuri/excelize/v2"
)

type TestDialogPaths struct {
	BackupSavePath  string `json:"backup_save_path"`
	ExportSavePath  string `json:"export_save_path"`
	RestoreOpenPath string `json:"restore_open_path"`
}

type App struct {
	ctx             context.Context
	searchCache     *sync.Map
	testDialogMu    sync.RWMutex
	testDialogPaths TestDialogPaths
	testDirMu       sync.Mutex
	testDir         string
}

func NewApp() *App {
	return &App{
		searchCache: &sync.Map{},
	}
}

func isTestEnv() bool {
	return strings.EqualFold(os.Getenv("APP_ENV"), "test")
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	database.InitDB()

	if isTestEnv() {
		return
	}

	go func() {
		if _, err := a.TriggerAutoBackup(); err != nil {
			log.Printf("Auto-backup failed: %v", err)
		}
	}()

	go a.syncFxRates()
}

func (a *App) IsTestEnv() bool {
	return isTestEnv()
}

func (a *App) SetTestDialogPaths(paths TestDialogPaths) {
	a.testDialogMu.Lock()
	a.testDialogPaths = paths
	a.testDialogMu.Unlock()
}

func (a *App) getTestDialogPaths() TestDialogPaths {
	a.testDialogMu.RLock()
	defer a.testDialogMu.RUnlock()
	return a.testDialogPaths
}

func (a *App) ensureTestDir() (string, error) {
	a.testDirMu.Lock()
	defer a.testDirMu.Unlock()

	if a.testDir != "" {
		return a.testDir, nil
	}

	base := filepath.Join(os.TempDir(), "cashflow-test")
	runID := strings.TrimSpace(os.Getenv("CASHFLOW_TEST_RUN_ID"))
	if runID != "" {
		base = filepath.Join(base, runID)
	}

	if err := os.MkdirAll(base, 0o755); err != nil {
		return "", fmt.Errorf("create test dir: %w", err)
	}

	a.testDir = base
	return base, nil
}

func ensureUniquePath(path string) string {
	if _, err := os.Stat(path); err != nil {
		return path
	}

	ext := filepath.Ext(path)
	base := strings.TrimSuffix(path, ext)
	timestamp := time.Now().Format("20060102_150405_000000000")
	return fmt.Sprintf("%s_%s%s", base, timestamp, ext)
}

func (a *App) testSavePath(kind, ext string) (string, error) {
	paths := a.getTestDialogPaths()
	switch kind {
	case "backup":
		if paths.BackupSavePath != "" {
			return ensureUniquePath(paths.BackupSavePath), nil
		}
	case "export":
		if paths.ExportSavePath != "" {
			return ensureUniquePath(paths.ExportSavePath), nil
		}
	}

	dir, err := a.ensureTestDir()
	if err != nil {
		return "", err
	}

	timestamp := time.Now().Format("20060102_150405_000000000")
	filename := fmt.Sprintf("cashflow_%s_%s.%s", kind, timestamp, ext)
	return filepath.Join(dir, filename), nil
}

func (a *App) testRestorePath() (string, error) {
	paths := a.getTestDialogPaths()
	if paths.RestoreOpenPath != "" {
		return paths.RestoreOpenPath, nil
	}

	dir, err := a.ensureTestDir()
	if err != nil {
		return "", err
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", err
	}

	var latestPath string
	var latestTime time.Time
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".db" {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if latestPath == "" || info.ModTime().After(latestTime) {
			latestPath = filepath.Join(dir, entry.Name())
			latestTime = info.ModTime()
		}
	}

	return latestPath, nil
}

func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

func (a *App) GetVersion() string {
	return version.Version
}

func (a *App) GetCurrencySettings() (database.CurrencySettings, error) {
	return database.GetCurrencySettings()
}

func (a *App) UpdateCurrencySettings(settings database.CurrencySettings) (database.CurrencySettings, error) {
	return database.UpdateCurrencySettings(settings)
}

func (a *App) GetFxRate(baseCurrency, quoteCurrency, date string) (*database.FxRateLookup, error) {
	return database.GetFxRate(baseCurrency, quoteCurrency, date)
}

func (a *App) GetFxRateStatus() (database.FxRateStatus, error) {
	settings, err := database.GetCurrencySettings()
	if err != nil {
		return database.FxRateStatus{}, err
	}
	return database.GetFxRateStatus(settings.MainCurrency)
}

func (a *App) SyncFxRates() error {
	go a.syncFxRates()
	return nil
}

func (a *App) ShowAbout() {
	runtime.EventsEmit(a.ctx, "show-about")
}

func (a *App) makeMenu() *menu.Menu {
	appMenu := menu.NewMenu()

	if stdlibRuntime.GOOS == "darwin" {
		// On macOS, the first menu added is the "Application Menu" (named after your app)
		applicationMenu := appMenu.AddSubmenu("Cashflow Tracker")

		applicationMenu.AddText("About Cashflow Tracker", nil, func(_ *menu.CallbackData) {
			a.ShowAbout()
		})

		applicationMenu.AddSeparator()
		applicationMenu.AddText("Services", nil, nil)
		applicationMenu.AddSeparator()
		applicationMenu.AddText("Hide Cashflow Tracker", keys.CmdOrCtrl("h"), func(_ *menu.CallbackData) {
			runtime.WindowHide(a.ctx)
		})
		applicationMenu.AddText("Quit", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
			runtime.Quit(a.ctx)
		})
	}

	// Add standard Edit menu (Cut, Copy, Paste, Select All)
	appMenu.Append(menu.EditMenu())
	appMenu.Append(menu.WindowMenu())

	if stdlibRuntime.GOOS != "darwin" {
		helpMenu := appMenu.AddSubmenu("Help")
		helpMenu.AddText("About Cashflow Tracker", nil, func(_ *menu.CallbackData) {
			a.ShowAbout()
		})
	}

	return appMenu
}

type TransactionInput struct {
	Date        string  `json:"date"`
	Description string  `json:"description"`
	Amount      float64 `json:"amount"`
	Category    string  `json:"category"`
	Account     string  `json:"account"`
	Owner       string  `json:"owner"`
	Currency    string  `json:"currency"`
}

type CategorizeResult struct {
	TransactionID int64   `json:"transaction_id"`
	AffectedIds   []int64 `json:"affected_ids"`
}

type RuleResult struct {
	RuleID      int64   `json:"rule_id"`
	AffectedIds []int64 `json:"affected_ids"`
}

type RuleUpdateResult struct {
	RuleID            int64 `json:"rule_id"`
	UncategorizeCount int   `json:"uncategorize_count"`
	AppliedCount      int   `json:"applied_count"`
}

type RuleDeleteResult struct {
	RuleID             int64 `json:"rule_id"`
	UncategorizedCount int   `json:"uncategorized_count"`
}

func (a *App) ImportTransactions(transactions []TransactionInput) error {
	var txModels []database.TransactionModel

	accountCache := make(map[string]int64)
	userCache := make(map[string]*int64)
	categoryCache := make(map[string]int64)
	settings, err := database.GetCurrencySettings()
	if err != nil {
		return err
	}
	defaultCurrency := strings.ToUpper(strings.TrimSpace(settings.MainCurrency))
	if defaultCurrency == "" {
		defaultCurrency = "CAD"
	}

	for _, t := range transactions {
		accID, ok := accountCache[t.Account]
		if !ok {
			id, err := database.GetOrCreateAccount(t.Account)
			if err != nil {
				return fmt.Errorf("Unable to process account '%s'. Please check the file format.", t.Account)
			}
			accID = id
			accountCache[t.Account] = accID
		}

		var ownerID *int64
		if t.Owner != "" {
			cached, ok := userCache[t.Owner]
			if !ok {
				id, err := database.GetOrCreateUser(t.Owner)
				if err != nil {
					return fmt.Errorf("Unable to process owner '%s'. Please check the file format.", t.Owner)
				}
				ownerID = id
				userCache[t.Owner] = ownerID
			} else {
				ownerID = cached
			}
		}

		var catID *int64
		if t.Category != "" {
			id, ok := categoryCache[t.Category]
			if !ok {
				var err error
				id, err = database.GetOrCreateCategory(t.Category)
				if err != nil {
					return fmt.Errorf("Unable to process category '%s'. Please check the file format.", t.Category)
				}
				categoryCache[t.Category] = id
			}
			catID = &id
		}

		currency := strings.ToUpper(strings.TrimSpace(t.Currency))
		if currency == "" {
			currency = defaultCurrency
		}

		txModels = append(txModels, database.TransactionModel{
			AccountID:   accID,
			OwnerID:     ownerID,
			Date:        t.Date,
			Description: t.Description,
			Amount:      t.Amount,
			CategoryID:  catID,
			Currency:    currency,
		})
	}

	if err := database.BatchInsertTransactions(txModels); err != nil {
		return err
	}
	if err := database.ApplyAllRules(); err != nil {
		return err
	}
	go a.syncFxRates()
	return nil
}

func (a *App) GetColumnMappings() ([]database.ColumnMappingModel, error) {
	return database.GetColumnMappings()
}

func (a *App) SaveColumnMapping(name string, mapping interface{}) (int64, error) {
	bytes, err := json.Marshal(mapping)
	if err != nil {
		return 0, fmt.Errorf("Unable to save column mapping. Please try again.")
	}
	return database.SaveColumnMapping(name, string(bytes))
}

func (a *App) DeleteColumnMapping(id int64) error {
	return database.DeleteColumnMapping(id)
}

func (a *App) GetUncategorizedTransactions() ([]database.TransactionModel, error) {
	return database.GetUncategorizedTransactions()
}

func (a *App) CategorizeTransaction(id int64, categoryName string) (*CategorizeResult, error) {
	if strings.TrimSpace(categoryName) == "" {
		return &CategorizeResult{TransactionID: id, AffectedIds: []int64{id}}, database.UpdateTransactionCategory(id, 0)
	}
	catID, err := database.GetOrCreateCategory(categoryName)
	if err != nil {
		return nil, err
	}
	return &CategorizeResult{TransactionID: id, AffectedIds: []int64{id}}, database.UpdateTransactionCategory(id, catID)
}

func (a *App) RenameCategory(id int64, newName string) error {
	return database.RenameCategory(id, newName)
}

func (a *App) SaveCategorizationRule(rule database.CategorizationRule) (*RuleResult, error) {
	if rule.CategoryID == 0 && rule.CategoryName != "" {
		id, err := database.GetOrCreateCategory(rule.CategoryName)
		if err != nil {
			return nil, err
		}
		rule.CategoryID = id
	}
	id, err := database.SaveRule(rule)
	if err != nil {
		return nil, err
	}
	_, affectedIds, err := database.ApplyRuleWithIds(id)
	if err != nil {
		return nil, err
	}
	return &RuleResult{RuleID: id, AffectedIds: affectedIds}, nil
}

func (a *App) GetCategorizationRules() ([]database.CategorizationRule, error) {
	return database.GetRules()
}

func (a *App) PreviewRuleMatches(matchValue string, matchType string, amountMin *float64, amountMax *float64) (database.RuleMatchPreview, error) {
	return database.PreviewRuleMatches(matchValue, matchType, amountMin, amountMax, true, 10)
}

func (a *App) GetRuleMatchCount(ruleID int64) (int, error) {
	rule, err := database.GetRuleByID(ruleID)
	if err != nil {
		return 0, err
	}
	matches, err := database.SearchTransactionsByRule(rule.MatchValue, rule.MatchType, rule.AmountMin, rule.AmountMax, true)
	if err != nil {
		return 0, err
	}
	return len(matches), nil
}

func (a *App) UpdateCategorizationRule(rule database.CategorizationRule, recategorize bool) (*RuleUpdateResult, error) {
	if rule.ID == 0 {
		return nil, fmt.Errorf("rule id is required")
	}
	if rule.MatchValue == "" {
		return nil, fmt.Errorf("match value cannot be empty")
	}
	if rule.CategoryID == 0 && rule.CategoryName != "" {
		id, err := database.GetOrCreateCategory(rule.CategoryName)
		if err != nil {
			return nil, err
		}
		rule.CategoryID = id
	}

	uncategorizeCount := 0
	if recategorize {
		oldRule, err := database.GetRuleByID(rule.ID)
		if err != nil {
			return nil, err
		}
		matches, err := database.SearchTransactionsByRule(oldRule.MatchValue, oldRule.MatchType, oldRule.AmountMin, oldRule.AmountMax, true)
		if err != nil {
			return nil, err
		}
		ids := make([]int64, 0, len(matches))
		for _, tx := range matches {
			ids = append(ids, tx.ID)
		}
		if err := database.ClearTransactionCategories(ids); err != nil {
			return nil, err
		}
		uncategorizeCount = len(ids)
	}

	if err := database.UpdateRule(rule); err != nil {
		return nil, err
	}

	appliedCount := 0
	if recategorize {
		_, affectedIds, err := database.ApplyRuleWithIds(rule.ID)
		if err != nil {
			return nil, err
		}
		appliedCount = len(affectedIds)
	}

	return &RuleUpdateResult{RuleID: rule.ID, UncategorizeCount: uncategorizeCount, AppliedCount: appliedCount}, nil
}

func (a *App) DeleteCategorizationRule(ruleID int64, uncategorize bool) (*RuleDeleteResult, error) {
	if ruleID == 0 {
		return nil, fmt.Errorf("rule id is required")
	}
	if !uncategorize {
		if err := database.DeleteRule(ruleID); err != nil {
			return nil, err
		}
		return &RuleDeleteResult{RuleID: ruleID, UncategorizedCount: 0}, nil
	}

	rule, err := database.GetRuleByID(ruleID)
	if err != nil {
		return nil, err
	}
	matches, err := database.SearchTransactionsByRule(rule.MatchValue, rule.MatchType, rule.AmountMin, rule.AmountMax, true)
	if err != nil {
		return nil, err
	}
	ids := make([]int64, 0, len(matches))
	for _, tx := range matches {
		ids = append(ids, tx.ID)
	}
	if err := database.ClearTransactionCategories(ids); err != nil {
		return nil, err
	}
	if err := database.DeleteRule(ruleID); err != nil {
		return nil, err
	}
	return &RuleDeleteResult{RuleID: ruleID, UncategorizedCount: len(ids)}, nil
}

func (a *App) UndoCategorizationRule(ruleId int64, transactionIds []int64) error {
	return database.UndoRule(ruleId, transactionIds)
}

func (a *App) GetCategorizationRulesCount() (int, error) {
	return database.GetRulesCount()
}

func (a *App) FuzzySearch(query string, items []string) []string {
	return fuzzy.Match(query, items)
}

func (a *App) SearchCategories(query string) ([]database.Category, error) {
	return database.SearchCategories(query)
}

func (a *App) GetCategories() ([]database.Category, error) {
	return database.GetAllCategories()
}

func (a *App) GetAccounts() ([]string, error) {
	return database.GetAccounts()
}

func (a *App) GetOwners() ([]string, error) {
	return database.GetUsers()
}

func (a *App) CreateAccount(name string) (int64, error) {
	return database.GetOrCreateAccount(name)
}

func (a *App) CreateOwner(name string) (int64, error) {
	res, err := database.GetOrCreateUser(name)
	if err != nil {
		return 0, err
	}
	if res == nil {
		return 0, fmt.Errorf("failed to create owner")
	}
	return *res, nil
}

func (a *App) SearchTransactions(descriptionMatch string, matchType string, amountMin *float64, amountMax *float64) ([]database.TransactionModel, error) {
	return database.SearchTransactions(descriptionMatch, matchType, amountMin, amountMax)
}

func (a *App) GetMonthList() ([]string, error) {
	return database.GetMonthList()
}

func (a *App) GetAnalysisTransactions(startDate string, endDate string, categoryIDs []int64) ([]database.TransactionModel, error) {
	return database.GetAnalysisTransactions(startDate, endDate, categoryIDs)
}

type ExcelData struct {
	Headers []string   `json:"headers"`
	Rows    [][]string `json:"rows"`
}

func (a *App) ParseExcel(base64Data string) (*ExcelData, error) {
	if idx := strings.Index(base64Data, ";base64,"); idx != -1 {
		base64Data = base64Data[idx+8:]
	}

	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return nil, fmt.Errorf("Unable to read the Excel file. The file may be corrupted.")
	}

	reader := strings.NewReader(string(data))
	f, err := excelize.OpenReader(reader)
	if err != nil {
		return nil, fmt.Errorf("Unable to read the Excel file. Please check if it's corrupted or password-protected.")
	}
	defer f.Close()

	sheetName := f.GetSheetName(0)
	if sheetName == "" {
		return nil, fmt.Errorf("The Excel file doesn't contain any data sheets.")
	}

	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, fmt.Errorf("Unable to read data from the Excel file.")
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf("The Excel file is empty. Please choose a file with data.")
	}

	headers := rows[0]
	var dataRows [][]string
	if len(rows) > 1 {
		dataRows = rows[1:]
	} else {
		dataRows = [][]string{}
	}

	for i, h := range headers {
		headers[i] = strings.TrimSpace(h)
	}

	for i, row := range dataRows {
		if len(row) < len(headers) {
			newRow := make([]string, len(headers))
			copy(newRow, row)
			dataRows[i] = newRow
		} else if len(row) > len(headers) {
			dataRows[i] = row[:len(headers)]
		}
	}

	return &ExcelData{
		Headers: headers,
		Rows:    dataRows,
	}, nil
}

type WebSearchResult struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
	Domain  string `json:"domain"`
}

func hashQuery(query string) string {
	h := sha256.Sum256([]byte(query))
	return fmt.Sprintf("%x", h)[:16]
}

func (a *App) SearchWeb(query string) ([]WebSearchResult, error) {
	if query == "" {
		return nil, fmt.Errorf("Please enter a search term.")
	}

	cacheKey := hashQuery(query)
	if cached, ok := a.searchCache.Load(cacheKey); ok {
		return cached.([]WebSearchResult), nil
	}

	results, err := brave.Search(query, 5)
	if err != nil {
		return nil, err
	}

	webResults := make([]WebSearchResult, 0, len(results))
	for _, r := range results {
		domain := ""
		if u, err := url.Parse(r.URL); err == nil {
			domain = u.Hostname()
		}

		webResults = append(webResults, WebSearchResult{
			Title:   r.Title,
			URL:     r.URL,
			Snippet: r.Snippet,
			Domain:  domain,
		})
	}

	a.searchCache.Store(cacheKey, webResults)

	return webResults, nil
}

func (a *App) ExportTransactionsWithDialog(startDate, endDate string, categoryIDs []int64, format string) (int, error) {
	defaultFilename := generateDefaultFilename(startDate, endDate, format)

	var destinationPath string
	var err error
	if isTestEnv() {
		destinationPath, err = a.testSavePath("export", format)
	} else {
		destinationPath, err = runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
			Title:           "Export Transactions",
			DefaultFilename: defaultFilename,
			Filters: []runtime.FileFilter{
				{
					DisplayName: format + " Files",
					Pattern:     "*." + format,
				},
				{
					DisplayName: "All Files",
					Pattern:     "*.*",
				},
			},
		})
	}
	if err != nil {
		return 0, fmt.Errorf("dialog cancelled or failed: %w", err)
	}

	if destinationPath == "" {
		return 0, fmt.Errorf("no destination selected")
	}

	return a.ExportTransactions(startDate, endDate, categoryIDs, format, destinationPath)
}

func generateDefaultFilename(startDate, endDate, format string) string {
	isSingleMonth := strings.HasPrefix(endDate, startDate[0:7])

	var datePart string
	if isSingleMonth {
		datePart = startDate[0:7]
	} else {
		datePart = startDate + "_to_" + endDate
	}

	return fmt.Sprintf("cashflow_%s.%s", datePart, format)
}

func (a *App) ExportTransactions(startDate, endDate string, categoryIDs []int64, format, destinationPath string) (int, error) {
	transactions, err := database.GetAnalysisTransactions(startDate, endDate, categoryIDs)
	if err != nil {
		return 0, fmt.Errorf("Unable to load transactions. Please try again.")
	}

	if len(transactions) == 0 {
		return 0, fmt.Errorf("No transactions found for this date range.")
	}

	settings, err := database.GetCurrencySettings()
	if err != nil {
		return 0, fmt.Errorf("Unable to load currency settings. Please try again.")
	}
	mainCurrency := strings.TrimSpace(settings.MainCurrency)
	if mainCurrency == "" {
		mainCurrency = "CAD"
	}

	switch strings.ToLower(format) {
	case "csv":
		return exportToCSV(transactions, destinationPath, mainCurrency)
	case "xlsx":
		return exportToXLSX(transactions, destinationPath, mainCurrency)
	default:
		return 0, fmt.Errorf("Unsupported format. Please choose CSV or Excel.")
	}
}

// sanitizeCSVField prevents CSV injection attacks by escaping leading formula characters
// See: https://owasp.org/www-community/attacks/CSV_Injection
func sanitizeCSVField(field string) string {
	if field == "" {
		return field
	}
	// Escape leading characters that could trigger Excel formulas
	// Common formula triggers: = + - @ \t \r
	// We prepend a tab character which forces Excel to treat the value as text
	firstChar := field[0]
	if firstChar == '=' || firstChar == '+' || firstChar == '-' || firstChar == '@' ||
		firstChar == '\t' || firstChar == '\r' {
		return "\t" + field
	}
	return field
}

func exportToCSV(transactions []database.TransactionModel, destinationPath string, mainCurrency string) (int, error) {
	file, err := os.Create(destinationPath)
	if err != nil {
		return 0, fmt.Errorf("Unable to create the export file. Please check your folder permissions.")
	}
	defer file.Close()

	if _, err := file.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return 0, fmt.Errorf("Unable to write the export file. Please check disk space and permissions.")
	}

	writer := csv.NewWriter(file)
	writer.UseCRLF = true
	defer writer.Flush()

	header := []string{"Date", "Description", "Amount (Main)", "Amount (Original)", "Currency (Original)", "Category", "Account", "Owner"}
	if err := writer.Write(header); err != nil {
		return 0, fmt.Errorf("Unable to write the export file. Please check disk space and permissions.")
	}

	for _, tx := range transactions {
		category := tx.CategoryName
		if tx.CategoryID == nil {
			category = ""
		}

		mainAmount := ""
		if converted, err := database.ConvertAmount(tx.Amount, mainCurrency, tx.Currency, tx.Date); err != nil {
			return 0, err
		} else if converted != nil {
			mainAmount = strconv.FormatFloat(*converted, 'f', -1, 64)
		}

		row := []string{
			tx.Date,
			sanitizeCSVField(tx.Description),
			mainAmount,
			strconv.FormatFloat(tx.Amount, 'f', -1, 64),
			sanitizeCSVField(tx.Currency),
			sanitizeCSVField(category),
			sanitizeCSVField(tx.AccountName),
			sanitizeCSVField(tx.OwnerName),
		}
		if err := writer.Write(row); err != nil {
			return 0, fmt.Errorf("Unable to write the export file. Please check disk space and permissions.")
		}
	}

	return len(transactions), nil
}

func exportToXLSX(transactions []database.TransactionModel, destinationPath string, mainCurrency string) (int, error) {
	f := excelize.NewFile()
	sheetName := "Transactions"
	f.SetSheetName("Sheet1", sheetName)

	headers := []string{"Date", "Description", "Amount (Main)", "Amount (Original)", "Currency (Original)", "Category", "Account", "Owner"}
	cols := []string{"A", "B", "C", "D", "E", "F", "G", "H"}

	headerStyle, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
	})
	if err != nil {
		return 0, fmt.Errorf("Unable to create the Excel file. Please try again.")
	}

	for i, header := range headers {
		cell := cols[i] + "1"
		if err := f.SetCellValue(sheetName, cell, header); err != nil {
			return 0, fmt.Errorf("Unable to create the Excel file. Please try again.")
		}
		if err := f.SetCellStyle(sheetName, cell, cell, headerStyle); err != nil {
			return 0, fmt.Errorf("Unable to create the Excel file. Please try again.")
		}
	}

	for i, tx := range transactions {
		row := i + 2

		category := tx.CategoryName
		if tx.CategoryID == nil {
			category = ""
		}

		var mainAmount interface{} = ""
		if converted, err := database.ConvertAmount(tx.Amount, mainCurrency, tx.Currency, tx.Date); err != nil {
			return 0, err
		} else if converted != nil {
			mainAmount = *converted
		}

		values := []interface{}{
			tx.Date,
			tx.Description,
			mainAmount,
			tx.Amount,
			tx.Currency,
			category,
			tx.AccountName,
			tx.OwnerName,
		}

		for j, val := range values {
			cell := cols[j] + strconv.Itoa(row)
			if err := f.SetCellValue(sheetName, cell, val); err != nil {
				return 0, fmt.Errorf("Unable to create the Excel file. Please try again.")
			}
		}
	}

	for i, col := range cols {
		maxWidth := float64(len(headers[i]))

		for _, tx := range transactions {
			var value string
			switch i {
			case 0:
				value = tx.Date
			case 1:
				value = tx.Description
			case 2:
				if converted, err := database.ConvertAmount(tx.Amount, mainCurrency, tx.Currency, tx.Date); err == nil && converted != nil {
					value = strconv.FormatFloat(*converted, 'f', -1, 64)
				}
			case 3:
				value = strconv.FormatFloat(tx.Amount, 'f', -1, 64)
			case 4:
				value = tx.Currency
			case 5:
				if tx.CategoryID != nil {
					value = tx.CategoryName
				} else {
					value = ""
				}
			case 6:
				value = tx.AccountName
			case 7:
				value = tx.OwnerName
			}

			width := float64(len(value))
			if width > maxWidth {
				maxWidth = width
			}
		}

		width := maxWidth + 2
		if width < 10 {
			width = 10
		}
		if width > 50 {
			width = 50
		}
		if err := f.SetColWidth(sheetName, col, col, width); err != nil {
			return 0, fmt.Errorf("Unable to create the Excel file. Please try again.")
		}
	}

	if err := f.SaveAs(destinationPath); err != nil {
		return 0, fmt.Errorf("Unable to save the Excel file. Please check disk space and permissions.")
	}

	return len(transactions), nil
}

func (a *App) CreateManualBackup() (string, error) {
	timestamp := time.Now().Format("20060102_150405")
	defaultFilename := fmt.Sprintf("cashflow_backup_%s.db", timestamp)

	var destinationPath string
	var err error
	if isTestEnv() {
		destinationPath, err = a.testSavePath("backup", "db")
	} else {
		destinationPath, err = runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
			Title:           "Create Backup",
			DefaultFilename: defaultFilename,
			Filters: []runtime.FileFilter{
				{
					DisplayName: "SQLite Database",
					Pattern:     "*.db",
				},
				{
					DisplayName: "All Files",
					Pattern:     "*.*",
				},
			},
		})
	}
	if err != nil {
		return "", err
	}

	if destinationPath == "" {
		return "", nil
	}

	if err := database.CreateBackup(destinationPath); err != nil {
		return "", fmt.Errorf("Unable to create backup: %s", err.Error())
	}

	return destinationPath, nil
}

func (a *App) GetLastBackupInfo() (map[string]interface{}, error) {
	lastTime, err := database.GetLastBackupTime()
	if err != nil {
		return nil, err
	}

	last := ""
	if !lastTime.IsZero() {
		last = lastTime.Format(time.RFC3339)
	}

	return map[string]interface{}{
		"lastBackupTime": last,
		"hasBackup":      !lastTime.IsZero(),
	}, nil
}

func (a *App) ValidateBackupFile(path string) (*database.BackupMetadata, error) {
	txCount, err := database.ValidateBackup(path)
	if err != nil {
		return nil, err
	}

	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}

	return &database.BackupMetadata{
		Path:             path,
		Size:             info.Size(),
		TransactionCount: txCount,
		CreatedAt:        info.ModTime(),
	}, nil
}

func (a *App) SelectBackupFile() (*database.BackupMetadata, error) {
	var backupPath string
	var err error
	if isTestEnv() {
		backupPath, err = a.testRestorePath()
	} else {
		backupPath, err = runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
			Title: "Select Backup to Restore",
			Filters: []runtime.FileFilter{
				{DisplayName: "SQLite Database", Pattern: "*.db"},
			},
		})
	}
	if err != nil {
		return nil, err
	}
	if backupPath == "" {
		return nil, fmt.Errorf("No backup file selected.")
	}

	return a.ValidateBackupFile(backupPath)
}

func (a *App) RestoreBackup(backupPath string) error {
	if strings.TrimSpace(backupPath) == "" {
		return fmt.Errorf("No backup file selected.")
	}
	return database.RestoreBackup(backupPath)
}

func (a *App) RestoreBackupFromDialog() (string, error) {
	meta, err := a.SelectBackupFile()
	if err != nil {
		return "", err
	}

	if err := database.RestoreBackup(meta.Path); err != nil {
		return "", fmt.Errorf("Unable to restore backup: %s", err.Error())
	}

	return meta.Path, nil
}

func (a *App) OpenBackupFolder() (string, error) {
	backupDir, err := database.EnsureBackupDir()
	if err != nil {
		return "", err
	}

	if isTestEnv() {
		return backupDir, nil
	}

	var cmd *osexec.Cmd
	switch stdlibRuntime.GOOS {
	case "darwin":
		cmd = osexec.Command("open", backupDir)
	case "windows":
		cmd = osexec.Command("explorer", backupDir)
	default:
		cmd = osexec.Command("xdg-open", backupDir)
	}

	if err := cmd.Start(); err != nil {
		return backupDir, nil
	}

	return backupDir, nil
}

func (a *App) TriggerAutoBackup() (string, error) {
	shouldBackup, err := database.ShouldAutoBackup()
	if err != nil {
		return "", err
	}

	if !shouldBackup {
		return "", nil
	}

	return database.CreateAutoBackup()
}

func (a *App) shutdown(ctx context.Context) {
	// Trigger auto-backup on exit if needed (with timeout to prevent hanging)
	done := make(chan struct{})
	go func() {
		_, _ = a.TriggerAutoBackup()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(15 * time.Second):
		log.Printf("Auto-backup on exit timed out after 15 seconds")
	}

	database.Close()
}

func (a *App) syncFxRates() {
	if a.ctx == nil {
		return
	}
	settings, err := database.GetCurrencySettings()
	if err != nil {
		log.Printf("FX sync settings error: %v", err)
		return
	}
	if err := fx.EnsureProviderSupported(settings.MainCurrency); err != nil {
		log.Printf("FX sync unsupported: %v", err)
		return
	}
	result, err := fx.SyncRates(a.ctx, settings.MainCurrency)
	if err != nil {
		log.Printf("FX sync failed: %v", err)
		return
	}
	if result.Updated > 0 {
		runtime.EventsEmit(a.ctx, "fx-rates-updated", result)
	}
}
