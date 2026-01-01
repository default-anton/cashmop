package main

import (
	"cashflow/internal/brave"
	"cashflow/internal/database"
	"cashflow/internal/fuzzy"
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
	stdlibRuntime "runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"github.com/xuri/excelize/v2"
)

// App struct
type App struct {
	ctx         context.Context
	searchCache *sync.Map
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		searchCache: &sync.Map{},
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	database.InitDB() // Initialize SQLite

	go func() {
		if _, err := a.TriggerAutoBackup(); err != nil {
			log.Printf("Auto-backup failed: %v", err)
		}
	}()
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// GetVersion returns the application version
func (a *App) GetVersion() string {
	return version.Version
}

// ShowAbout triggers the About dialog in the frontend
func (a *App) ShowAbout() {
	runtime.EventsEmit(a.ctx, "show-about")
}

type TransactionInput struct {
	Date        string  `json:"date"`
	Description string  `json:"description"`
	Amount      float64 `json:"amount"`
	Category    string  `json:"category"`
	Account     string  `json:"account"` // Name of the account
	Owner       string  `json:"owner"`   // Name of the owner
}

func (a *App) ImportTransactions(transactions []TransactionInput) error {
	var txModels []database.TransactionModel

	// Cache lookups to minimize DB hits if many rows share the same account/owner/category
	accountCache := make(map[string]int64)
	userCache := make(map[string]*int64)
	categoryCache := make(map[string]int64)

	for _, t := range transactions {
		// 1. Account
		accID, ok := accountCache[t.Account]
		if !ok {
			id, err := database.GetOrCreateAccount(t.Account)
			if err != nil {
				return fmt.Errorf("Unable to process account '%s'. Please check the file format.", t.Account)
			}
			accID = id
			accountCache[t.Account] = accID
		}

		// 2. User/Owner
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

		// 3. Category
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

		txModels = append(txModels, database.TransactionModel{
			AccountID:   accID,
			OwnerID:     ownerID,
			Date:        t.Date,
			Description: t.Description,
			Amount:      t.Amount,
			CategoryID:  catID,
			Currency:    "CAD", // Default or passed in? For now default as per plan/schema
		})
	}

	if err := database.BatchInsertTransactions(txModels); err != nil {
		return err
	}
	return database.ApplyAllRules()
}

// GetColumnMappings returns all saved column mappings
func (a *App) GetColumnMappings() ([]database.ColumnMappingModel, error) {
	return database.GetColumnMappings()
}

// SaveColumnMapping saves a column mapping to the database
func (a *App) SaveColumnMapping(name string, mapping interface{}) (int64, error) {
	bytes, err := json.Marshal(mapping)
	if err != nil {
		return 0, fmt.Errorf("Unable to save column mapping. Please try again.")
	}
	return database.SaveColumnMapping(name, string(bytes))
}

// DeleteColumnMapping deletes a column mapping by ID
func (a *App) DeleteColumnMapping(id int64) error {
	return database.DeleteColumnMapping(id)
}

// GetUncategorizedTransactions returns transactions that need categorization
func (a *App) GetUncategorizedTransactions() ([]database.TransactionModel, error) {
	return database.GetUncategorizedTransactions()
}

// CategorizeTransaction updates a single transaction's category
func (a *App) CategorizeTransaction(id int64, categoryName string) error {
	if strings.TrimSpace(categoryName) == "" {
		return database.UpdateTransactionCategory(id, 0)
	}
	catID, err := database.GetOrCreateCategory(categoryName)
	if err != nil {
		return err
	}
	return database.UpdateTransactionCategory(id, catID)
}

// RenameCategory renames an existing category
func (a *App) RenameCategory(id int64, newName string) error {
	return database.RenameCategory(id, newName)
}

// SaveCategorizationRule saves a new rule and applies it to existing uncategorized transactions
func (a *App) SaveCategorizationRule(rule database.CategorizationRule) (int64, error) {
	if rule.CategoryID == 0 && rule.CategoryName != "" {
		id, err := database.GetOrCreateCategory(rule.CategoryName)
		if err != nil {
			return 0, err
		}
		rule.CategoryID = id
	}
	id, err := database.SaveRule(rule)
	if err != nil {
		return 0, err
	}
	// Auto-apply rule immediately
	_, _ = database.ApplyRule(id)
	return id, nil
}

// GetCategorizationRulesCount returns the number of existing categorization rules
func (a *App) GetCategorizationRulesCount() (int, error) {
	return database.GetRulesCount()
}

// FuzzySearch ranks items based on the query using fzf algorithm
func (a *App) FuzzySearch(query string, items []string) []string {
	return fuzzy.Match(query, items)
}

// SearchCategories returns suggestions for categories
func (a *App) SearchCategories(query string) ([]database.Category, error) {
	return database.SearchCategories(query)
}

// GetCategories returns all categories
func (a *App) GetCategories() ([]database.Category, error) {
	return database.GetAllCategories()
}

// GetAccounts returns all accounts
func (a *App) GetAccounts() ([]string, error) {
	return database.GetAccounts()
}

// GetOwners returns all users/owners
func (a *App) GetOwners() ([]string, error) {
	return database.GetUsers()
}

// CreateAccount ensures an account exists
func (a *App) CreateAccount(name string) (int64, error) {
	return database.GetOrCreateAccount(name)
}

// CreateOwner ensures a user/owner exists
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

// SearchTransactions returns transactions matching the criteria
func (a *App) SearchTransactions(descriptionMatch string, matchType string, amountMin *float64, amountMax *float64) ([]database.TransactionModel, error) {
	return database.SearchTransactions(descriptionMatch, matchType, amountMin, amountMax)
}

// GetMonthList returns unique year-month strings
func (a *App) GetMonthList() ([]string, error) {
	return database.GetMonthList()
}

// GetAnalysisTransactions returns transactions for a date range and optional category filter
func (a *App) GetAnalysisTransactions(startDate string, endDate string, categoryIDs []int64) ([]database.TransactionModel, error) {
	return database.GetAnalysisTransactions(startDate, endDate, categoryIDs)
}

type ExcelData struct {
	Headers []string   `json:"headers"`
	Rows    [][]string `json:"rows"`
}

// ParseExcel parses an Excel file from base64 string
func (a *App) ParseExcel(base64Data string) (*ExcelData, error) {
	// Remove data URL prefix if present
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

	// Get first sheet
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

	// Clean headers (remove leading/trailing whitespace)
	for i, h := range headers {
		headers[i] = strings.TrimSpace(h)
	}

	// Ensure all rows have the same length as headers
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

// WebSearchResult represents a single web search result
type WebSearchResult struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
	Domain  string `json:"domain"`
}

// hashQuery creates a simple hash of the query string for caching
func hashQuery(query string) string {
	h := sha256.Sum256([]byte(query))
	return fmt.Sprintf("%x", h)[:16]
}

// SearchWeb performs a web search using Brave Search API
// Returns top 5 results with caching (session-only)
func (a *App) SearchWeb(query string) ([]WebSearchResult, error) {
	if query == "" {
		return nil, fmt.Errorf("Please enter a search term.")
	}

	// Check cache
	cacheKey := hashQuery(query)
	if cached, ok := a.searchCache.Load(cacheKey); ok {
		return cached.([]WebSearchResult), nil
	}

	// Call Brave search (top 5 results)
	results, err := brave.Search(query, 5)
	if err != nil {
		return nil, err
	}

	// Transform to frontend format with domain extraction
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

	// Cache results
	a.searchCache.Store(cacheKey, webResults)

	return webResults, nil
}

// ExportTransactionsWithDialog exports filtered transactions with native file dialog
// Takes filter parameters and format, shows native save dialog, and exports
// Returns the number of rows exported or an error
func (a *App) ExportTransactionsWithDialog(startDate, endDate string, categoryIDs []int64, format string) (int, error) {
	// Generate default filename based on date range
	defaultFilename := generateDefaultFilename(startDate, endDate, format)

	// Show native save dialog
	destinationPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
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
	if err != nil {
		return 0, fmt.Errorf("dialog cancelled or failed: %w", err)
	}

	if destinationPath == "" {
		return 0, fmt.Errorf("no destination selected")
	}

	// Perform export
	return a.ExportTransactions(startDate, endDate, categoryIDs, format, destinationPath)
}

// generateDefaultFilename creates a filename based on the spec convention
func generateDefaultFilename(startDate, endDate, format string) string {
	// Check if it's a single month (same month in start and end)
	isSingleMonth := strings.HasPrefix(endDate, startDate[0:7])

	var datePart string
	if isSingleMonth {
		// Single month: cashflow_2025-01.csv
		datePart = startDate[0:7] // YYYY-MM
	} else {
		// Date range: cashflow_2025-01-01_to_2025-03-31.csv
		datePart = startDate + "_to_" + endDate
	}

	return fmt.Sprintf("cashflow_%s.%s", datePart, format)
}

// ExportTransactions exports filtered transactions to CSV or XLSX format
// Returns the number of rows exported or an error
func (a *App) ExportTransactions(startDate, endDate string, categoryIDs []int64, format, destinationPath string) (int, error) {
	// Fetch transactions using existing filter logic
	transactions, err := database.GetAnalysisTransactions(startDate, endDate, categoryIDs)
	if err != nil {
		return 0, fmt.Errorf("Unable to load transactions. Please try again.")
	}

	if len(transactions) == 0 {
		return 0, fmt.Errorf("No transactions found for this date range.")
	}

	switch strings.ToLower(format) {
	case "csv":
		return exportToCSV(transactions, destinationPath)
	case "xlsx":
		return exportToXLSX(transactions, destinationPath)
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

// exportToCSV writes transactions to CSV with UTF-8 BOM for Excel compatibility
func exportToCSV(transactions []database.TransactionModel, destinationPath string) (int, error) {
	file, err := os.Create(destinationPath)
	if err != nil {
		return 0, fmt.Errorf("Unable to create the export file. Please check your folder permissions.")
	}
	defer file.Close()

	// Write UTF-8 BOM for Excel/Numbers compatibility
	if _, err := file.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return 0, fmt.Errorf("Unable to write the export file. Please check disk space and permissions.")
	}

	writer := csv.NewWriter(file)
	writer.UseCRLF = true
	defer writer.Flush()

	// Write header
	header := []string{"Date", "Description", "Amount", "Category", "Account", "Owner", "Currency"}
	if err := writer.Write(header); err != nil {
		return 0, fmt.Errorf("Unable to write the export file. Please check disk space and permissions.")
	}

	// Write rows
	for _, tx := range transactions {
		category := tx.CategoryName
		if tx.CategoryID == nil {
			category = ""
		}

		row := []string{
			tx.Date,
			sanitizeCSVField(tx.Description),
			strconv.FormatFloat(tx.Amount, 'f', -1, 64),
			sanitizeCSVField(category),
			sanitizeCSVField(tx.AccountName),
			sanitizeCSVField(tx.OwnerName),
			sanitizeCSVField(tx.Currency),
		}
		if err := writer.Write(row); err != nil {
			return 0, fmt.Errorf("Unable to write the export file. Please check disk space and permissions.")
		}
	}

	return len(transactions), nil
}

// exportToXLSX writes transactions to Excel with auto-column widths
func exportToXLSX(transactions []database.TransactionModel, destinationPath string) (int, error) {
	f := excelize.NewFile()
	sheetName := "Transactions"
	f.SetSheetName("Sheet1", sheetName)

	// Define headers and column letters
	headers := []string{"Date", "Description", "Amount", "Category", "Account", "Owner", "Currency"}
	cols := []string{"A", "B", "C", "D", "E", "F", "G"}

	// Write header row with bold formatting
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

	// Write data rows
	for i, tx := range transactions {
		row := i + 2

		category := tx.CategoryName
		if tx.CategoryID == nil {
			category = ""
		}

		values := []interface{}{
			tx.Date,
			tx.Description,
			tx.Amount,
			category,
			tx.AccountName,
			tx.OwnerName,
			tx.Currency,
		}

		for j, val := range values {
			cell := cols[j] + strconv.Itoa(row)
			if err := f.SetCellValue(sheetName, cell, val); err != nil {
				return 0, fmt.Errorf("Unable to create the Excel file. Please try again.")
			}
		}
	}

	// Auto-calculate column widths based on content
	for i, col := range cols {
		maxWidth := float64(len(headers[i]))

		// Check data width
		for _, tx := range transactions {
			var value string
			switch i {
			case 0:
				value = tx.Date
			case 1:
				value = tx.Description
			case 2:
				value = strconv.FormatFloat(tx.Amount, 'f', -1, 64)
			case 3:
				if tx.CategoryID != nil {
					value = tx.CategoryName
				} else {
					value = ""
				}
			case 4:
				value = tx.AccountName
			case 5:
				value = tx.OwnerName
			case 6:
				value = tx.Currency
			}

			width := float64(len(value))
			if width > maxWidth {
				maxWidth = width
			}
		}

		// Set column width (min 10, max 50, with some padding)
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

	// Save file
	if err := f.SaveAs(destinationPath); err != nil {
		return 0, fmt.Errorf("Unable to save the Excel file. Please check disk space and permissions.")
	}

	return len(transactions), nil
}

// CreateManualBackup creates a manual backup with a user-chosen destination
func (a *App) CreateManualBackup() (string, error) {
	timestamp := time.Now().Format("20060102_150405")
	defaultFilename := fmt.Sprintf("cashflow_backup_%s.db", timestamp)

	destinationPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
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
	if err != nil {
		return "", err // Don't show error if user cancelled the dialog
	}

	if destinationPath == "" {
		return "", nil // User cancelled, no error needed
	}

	if err := database.CreateBackup(destinationPath); err != nil {
		return "", fmt.Errorf("Unable to create backup: %s", err.Error())
	}

	return destinationPath, nil
}

// GetLastBackupInfo returns information about the most recent backup
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

// ValidateBackupFile validates a backup file and returns its metadata
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

// SelectBackupFile opens a picker and returns validated metadata
func (a *App) SelectBackupFile() (*database.BackupMetadata, error) {
	backupPath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Backup to Restore",
		Filters: []runtime.FileFilter{
			{DisplayName: "SQLite Database", Pattern: "*.db"},
		},
	})
	if err != nil {
		return nil, err // Don't show error if user cancelled the dialog
	}
	if backupPath == "" {
		return nil, fmt.Errorf("No backup file selected.")
	}

	return a.ValidateBackupFile(backupPath)
}

// RestoreBackup restores from a validated backup path
func (a *App) RestoreBackup(backupPath string) error {
	if strings.TrimSpace(backupPath) == "" {
		return fmt.Errorf("No backup file selected.")
	}
	return database.RestoreBackup(backupPath)
}

// RestoreBackupFromDialog shows file picker and restores selected backup
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

// OpenBackupFolder opens the platform-specific backup folder
func (a *App) OpenBackupFolder() (string, error) {
	backupDir, err := database.EnsureBackupDir()
	if err != nil {
		return "", err
	}

	// Try to open the folder with the system file manager
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
		// If opening fails, just return the path
		return backupDir, nil
	}

	return backupDir, nil
}

// TriggerAutoBackup checks if auto-backup is needed and creates one
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

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	// Trigger auto-backup on exit if needed (with timeout to prevent hanging)
	done := make(chan struct{})
	go func() {
		_, _ = a.TriggerAutoBackup()
		close(done)
	}()
	select {
	case <-done:
		// Backup completed successfully
	case <-time.After(15 * time.Second):
		log.Printf("Auto-backup on exit timed out after 15 seconds")
	}

	// Close database
	database.Close()
}
