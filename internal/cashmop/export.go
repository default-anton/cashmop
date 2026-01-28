package cashmop

import (
	"encoding/csv"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/default-anton/cashmop/internal/database"

	"github.com/xuri/excelize/v2"
)

type ExportParams struct {
	StartDate        string
	EndDate          string
	CategoryIDs      []int64
	OwnerIDs         []int64
	Format           string
	DestinationPath  string
	MainCurrencyHint string
}

func (s *Service) ExportTransactions(params ExportParams) (int, error) {
	transactions, err := s.store.GetAnalysisTransactions(params.StartDate, params.EndDate, params.CategoryIDs, params.OwnerIDs)
	if err != nil {
		return 0, fmt.Errorf("Unable to load transactions. Please try again.")
	}

	if len(transactions) == 0 {
		return 0, fmt.Errorf("No transactions found for this date range.")
	}

	mainCurrency := strings.TrimSpace(params.MainCurrencyHint)
	if mainCurrency == "" {
		settings, err := s.store.GetCurrencySettings()
		if err != nil {
			return 0, fmt.Errorf("Unable to load currency settings. Please try again.")
		}
		mainCurrency = strings.TrimSpace(settings.MainCurrency)
	}
	if mainCurrency == "" {
		mainCurrency = database.DefaultCurrency()
	}

	switch strings.ToLower(params.Format) {
	case "csv":
		return exportToCSV(s.store, transactions, params.DestinationPath, mainCurrency)
	case "xlsx":
		return exportToXLSX(s.store, transactions, params.DestinationPath, mainCurrency)
	default:
		return 0, fmt.Errorf("Unsupported format. Please choose CSV or Excel.")
	}
}

// SanitizeCSVField prevents CSV injection attacks by escaping leading formula characters.
// See: https://owasp.org/www-community/attacks/CSV_Injection
func SanitizeCSVField(field string) string {
	if field == "" {
		return field
	}
	firstChar := field[0]
	if firstChar == '=' || firstChar == '+' || firstChar == '-' || firstChar == '@' || firstChar == '\t' || firstChar == '\r' {
		return "\t" + field
	}
	return field
}

func formatCents(cents int64) string {
	sign := ""
	v := cents
	if v < 0 {
		sign = "-"
		v = -v
	}
	return fmt.Sprintf("%s%d.%02d", sign, v/100, v%100)
}

func centsToFloat64(cents int64) float64 {
	return float64(cents) / 100.0
}

type exportRow struct {
	Date           string
	Description    string
	MainAmount     *int64
	OriginalAmount int64
	Currency       string
	Category       string
	Account        string
	Owner          string
}

func buildExportRows(store *database.Store, transactions []database.TransactionModel, mainCurrency string) ([]exportRow, error) {
	rows := make([]exportRow, 0, len(transactions))
	for _, tx := range transactions {
		category := tx.CategoryName
		if tx.CategoryID == nil {
			category = ""
		}

		var mainAmount *int64
		if converted, err := store.ConvertAmount(tx.Amount, mainCurrency, tx.Currency, tx.Date); err != nil {
			return nil, err
		} else {
			mainAmount = converted
		}

		rows = append(rows, exportRow{
			Date:           tx.Date,
			Description:    tx.Description,
			MainAmount:     mainAmount,
			OriginalAmount: tx.Amount,
			Currency:       tx.Currency,
			Category:       category,
			Account:        tx.AccountName,
			Owner:          tx.OwnerName,
		})
	}
	return rows, nil
}

func exportToCSV(store *database.Store, transactions []database.TransactionModel, destinationPath string, mainCurrency string) (int, error) {
	rows, err := buildExportRows(store, transactions, mainCurrency)
	if err != nil {
		return 0, err
	}

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

	for _, r := range rows {
		mainAmount := ""
		if r.MainAmount != nil {
			mainAmount = formatCents(*r.MainAmount)
		}
		row := []string{
			r.Date,
			SanitizeCSVField(r.Description),
			mainAmount,
			formatCents(r.OriginalAmount),
			SanitizeCSVField(r.Currency),
			SanitizeCSVField(r.Category),
			SanitizeCSVField(r.Account),
			SanitizeCSVField(r.Owner),
		}
		if err := writer.Write(row); err != nil {
			return 0, fmt.Errorf("Unable to write the export file. Please check disk space and permissions.")
		}
	}

	return len(rows), nil
}

func exportToXLSX(store *database.Store, transactions []database.TransactionModel, destinationPath string, mainCurrency string) (int, error) {
	rows, err := buildExportRows(store, transactions, mainCurrency)
	if err != nil {
		return 0, err
	}

	f := excelize.NewFile()
	sheetName := "Transactions"
	f.SetSheetName("Sheet1", sheetName)

	headers := []string{"Date", "Description", "Amount (Main)", "Amount (Original)", "Currency (Original)", "Category", "Account", "Owner"}
	cols := []string{"A", "B", "C", "D", "E", "F", "G", "H"}

	headerStyle, err := f.NewStyle(&excelize.Style{Font: &excelize.Font{Bold: true}})
	if err != nil {
		return 0, fmt.Errorf("Unable to create the Excel file. Please try again.")
	}

	amountStyle, err := f.NewStyle(&excelize.Style{NumFmt: 2})
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

	for i, r := range rows {
		row := i + 2

		var mainAmount interface{} = ""
		if r.MainAmount != nil {
			mainAmount = centsToFloat64(*r.MainAmount)
		}

		values := []interface{}{
			r.Date,
			r.Description,
			mainAmount,
			centsToFloat64(r.OriginalAmount),
			r.Currency,
			r.Category,
			r.Account,
			r.Owner,
		}

		for j, val := range values {
			cell := cols[j] + strconv.Itoa(row)
			if err := f.SetCellValue(sheetName, cell, val); err != nil {
				return 0, fmt.Errorf("Unable to create the Excel file. Please try again.")
			}
			if j == 2 || j == 3 {
				_ = f.SetCellStyle(sheetName, cell, cell, amountStyle)
			}
		}
	}

	// Basic autosize pass.
	for i, col := range cols {
		maxWidth := float64(len(headers[i]))
		for _, r := range rows {
			var value string
			switch i {
			case 0:
				value = r.Date
			case 1:
				value = r.Description
			case 2:
				if r.MainAmount != nil {
					value = formatCents(*r.MainAmount)
				}
			case 3:
				value = formatCents(r.OriginalAmount)
			case 4:
				value = r.Currency
			case 5:
				value = r.Category
			case 6:
				value = r.Account
			case 7:
				value = r.Owner
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

	return len(rows), nil
}
