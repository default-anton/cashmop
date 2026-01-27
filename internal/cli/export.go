package cli

import (
	"encoding/csv"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/default-anton/cashmop/internal/database"

	"github.com/xuri/excelize/v2"
)

type exportResponse struct {
	Ok    bool   `json:"ok"`
	Count int    `json:"count"`
	Path  string `json:"path"`
}

func handleExport(args []string) commandResult {
	fs := newSubcommandFlagSet("export")
	var start string
	var end string
	var format string
	var out string
	var categoryIDs stringSliceFlag

	fs.StringVar(&start, "start", "", "")
	fs.StringVar(&end, "end", "", "")
	fs.StringVar(&format, "format", "", "")
	fs.StringVar(&out, "out", "", "")
	fs.Var(&categoryIDs, "category-ids", "")

	if ok, res := fs.parse(args, "export"); !ok {
		return res
	}

	if start == "" || end == "" || format == "" || out == "" {
		var details []ErrorDetail
		if start == "" {
			details = append(details, requiredFlagError("start", "Provide --start YYYY-MM-DD."))
		}
		if end == "" {
			details = append(details, requiredFlagError("end", "Provide --end YYYY-MM-DD."))
		}
		if format == "" {
			details = append(details, requiredFlagError("format", "Provide --format csv or xlsx."))
		}
		if out == "" {
			details = append(details, requiredFlagError("out", "Provide --out <path>."))
		}
		return commandResult{Err: validationError(details...)}
	}

	start, end, cErr := validateDateRange(start, end)
	if cErr != nil {
		return commandResult{Err: cErr}
	}

	if format != "csv" && format != "xlsx" {
		return commandResult{Err: validationError(ErrorDetail{Field: "format", Message: "Format must be csv or xlsx.", Hint: "Use --format csv or --format xlsx."})}
	}

	var catIDs []int64
	for _, s := range categoryIDs.values {
		parts := strings.Split(s, ",")
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p == "" {
				continue
			}
			var id int64
			if _, err := fmt.Sscanf(p, "%d", &id); err != nil {
				return commandResult{Err: validationError(ErrorDetail{Field: "category-ids", Message: fmt.Sprintf("Invalid category ID: %s", p), Hint: "Provide comma-separated numeric IDs."})}
			}
			catIDs = append(catIDs, id)
		}
	}

	transactions, err := database.GetAnalysisTransactions(start, end, catIDs, nil)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	if len(transactions) == 0 {
		return commandResult{Err: runtimeError(ErrorDetail{Message: "No transactions found for this date range."})}
	}

	settings, err := database.GetCurrencySettings()
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}
	mainCurrency := settings.MainCurrency
	if mainCurrency == "" {
		mainCurrency = database.DefaultCurrency()
	}

	var count int
	switch strings.ToLower(format) {
	case "csv":
		count, err = exportToCSV(transactions, out, mainCurrency)
	case "xlsx":
		count, err = exportToXLSX(transactions, out, mainCurrency)
	default:
		return commandResult{Err: validationError(ErrorDetail{Field: "format", Message: "Unsupported format.", Hint: "Use --format csv or --format xlsx."})}
	}

	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: exportResponse{Ok: true, Count: count, Path: out}}
}

func sanitizeCSVField(field string) string {
	if field == "" {
		return field
	}
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
		return 0, fmt.Errorf("Unable to create export file: %w", err)
	}
	defer file.Close()

	if _, err := file.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return 0, err
	}

	writer := csv.NewWriter(file)
	writer.UseCRLF = true
	defer writer.Flush()

	header := []string{"Date", "Description", "Amount (Main)", "Amount (Original)", "Currency (Original)", "Category", "Account", "Owner"}
	if err := writer.Write(header); err != nil {
		return 0, err
	}

	for _, tx := range transactions {
		category := tx.CategoryName
		if tx.CategoryID == nil {
			category = ""
		}

		mainAmount := ""
		if converted, err := database.ConvertAmount(tx.Amount, mainCurrency, tx.Currency, tx.Date); err == nil && converted != nil {
			mainAmount = formatCentsDecimal(*converted)
		}

		row := []string{
			tx.Date,
			sanitizeCSVField(tx.Description),
			mainAmount,
			formatCentsDecimal(tx.Amount),
			sanitizeCSVField(tx.Currency),
			sanitizeCSVField(category),
			sanitizeCSVField(tx.AccountName),
			sanitizeCSVField(tx.OwnerName),
		}
		if err := writer.Write(row); err != nil {
			return 0, err
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

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
	})

	for i, header := range headers {
		cell := cols[i] + "1"
		f.SetCellValue(sheetName, cell, header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}

	for i, tx := range transactions {
		row := i + 2
		category := tx.CategoryName
		if tx.CategoryID == nil {
			category = ""
		}

		var mainAmount interface{} = ""
		if converted, err := database.ConvertAmount(tx.Amount, mainCurrency, tx.Currency, tx.Date); err == nil && converted != nil {
			mainAmount = formatCentsDecimal(*converted)
		}

		values := []interface{}{
			tx.Date,
			tx.Description,
			mainAmount,
			formatCentsDecimal(tx.Amount),
			tx.Currency,
			category,
			tx.AccountName,
			tx.OwnerName,
		}

		for j, val := range values {
			cell := cols[j] + strconv.Itoa(row)
			f.SetCellValue(sheetName, cell, val)
		}
	}

	if err := f.SaveAs(destinationPath); err != nil {
		return 0, err
	}
	return len(transactions), nil
}
