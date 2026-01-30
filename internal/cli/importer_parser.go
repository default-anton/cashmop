package cli

import (
	"bytes"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/extrame/xls"
	"github.com/xuri/excelize/v2"
)

type parsedFile struct {
	headers []string
	rows    [][]string
}

func parseFileForImport(path string) (*parsedFile, error) {
	lower := strings.ToLower(path)
	if strings.HasSuffix(lower, ".csv") {
		return parseCSVFile(path)
	}
	if strings.HasSuffix(lower, ".xlsx") {
		return parseXLSXFile(path)
	}
	if strings.HasSuffix(lower, ".xls") {
		return parseXLSFile(path)
	}
	return nil, fmt.Errorf("Unsupported file type. Please upload a .csv, .xlsx, or .xls file.")
}

func parseCSVFile(path string) (*parsedFile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("Unable to read file: %w", err)
	}

	// Remove BOM if present
	data = bytes.TrimPrefix(data, []byte("\xEF\xBB\xBF"))
	text := strings.ReplaceAll(string(data), "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")

	lines := strings.Split(text, "\n")
	var rawRows [][]string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		rawRows = append(rawRows, parseCSVLine(trimmed))
	}

	if len(rawRows) == 0 {
		return nil, fmt.Errorf("File is empty.")
	}

	hasHeader := detectHeaderRow(rawRows)
	headers, rows := buildParsedRows(rawRows, hasHeader)

	return &parsedFile{headers: headers, rows: rows}, nil
}

func parseXLSXFile(path string) (*parsedFile, error) {
	f, err := excelize.OpenFile(path)
	if err != nil {
		return nil, fmt.Errorf("Unable to open Excel file: %w", err)
	}
	defer f.Close()

	sheet := f.GetSheetName(0)
	if sheet == "" {
		return nil, fmt.Errorf("Excel file has no sheets.")
	}

	rows, err := f.GetRows(sheet)
	if err != nil {
		return nil, fmt.Errorf("Unable to read Excel rows: %w", err)
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf("Excel file is empty.")
	}

	// Trim cells
	for i := range rows {
		for j := range rows[i] {
			rows[i][j] = strings.TrimSpace(rows[i][j])
		}
	}

	hasHeader := detectHeaderRow(rows)
	headers, dataRows := buildParsedRows(rows, hasHeader)

	return &parsedFile{headers: headers, rows: dataRows}, nil
}

func parseXLSFile(path string) (*parsedFile, error) {
	wb, err := xls.Open(path, "utf-8")
	if err != nil {
		return nil, fmt.Errorf("Unable to open .xls file: %w", err)
	}

	sheet := wb.GetSheet(0)
	if sheet == nil {
		return nil, fmt.Errorf(".xls file has no sheets.")
	}

	var rows [][]string
	for i := 0; i <= int(sheet.MaxRow); i++ {
		row := sheet.Row(i)
		var cells []string
		for j := 0; j < row.LastCol(); j++ {
			cells = append(cells, row.Col(j))
		}
		rows = append(rows, cells)
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf(".xls file is empty.")
	}

	// Trim cells
	for i := range rows {
		for j := range rows[i] {
			rows[i][j] = strings.TrimSpace(rows[i][j])
		}
	}

	hasHeader := detectHeaderRow(rows)
	headers, dataRows := buildParsedRows(rows, hasHeader)

	return &parsedFile{headers: headers, rows: dataRows}, nil
}

func parseCSVLine(line string) []string {
	var out []string
	var cur strings.Builder
	inQuotes := false

	for i := 0; i < len(line); i++ {
		ch := line[i]
		if ch == '"' {
			if inQuotes && i+1 < len(line) && line[i+1] == '"' {
				cur.WriteByte('"')
				i++
			} else {
				inQuotes = !inQuotes
			}
			continue
		}
		if ch == ',' && !inQuotes {
			out = append(out, strings.TrimSpace(cur.String()))
			cur.Reset()
			continue
		}
		cur.WriteByte(ch)
	}
	out = append(out, strings.TrimSpace(cur.String()))
	return out
}

var headerKeywords = []string{
	"date", "amount", "description", "memo", "payee", "merchant",
	"account", "category", "debit", "credit", "type", "currency",
	"balance", "value",
}

func detectHeaderRow(rows [][]string) bool {
	if len(rows) == 0 {
		return false
	}
	first := rows[0]

	keywordHits := 0
	for _, cell := range first {
		lower := strings.ToLower(strings.TrimSpace(cell))
		for _, kw := range headerKeywords {
			if strings.Contains(lower, kw) {
				keywordHits++
				break
			}
		}
	}
	if keywordHits > 0 {
		return true
	}

	if len(rows) < 2 {
		return false
	}
	second := rows[1]

	stats := func(row []string) (int, int, int) {
		var num, date, txt int
		for _, cell := range row {
			cell = strings.TrimSpace(cell)
			if cell == "" {
				continue
			}
			if !parseDateLoose(cell).IsZero() {
				date++
				continue
			}
			cleaned := amountCleanupRegex.ReplaceAllString(cell, "")
			if _, err := strconv.ParseFloat(cleaned, 64); err == nil {
				num++
				continue
			}
			txt++
		}
		return num, date, txt
	}

	n1, d1, t1 := stats(first)
	n2, d2, t2 := stats(second)

	score1 := n1 + d1
	score2 := n2 + d2

	if score1 >= 2 && score2 >= 1 {
		return false
	}
	if score1 >= 2 && t1 == 0 {
		return false
	}
	if score2 > score1 && t1 >= t2 {
		return true
	}
	if score1 == 0 && score2 >= 1 {
		return true
	}

	return true
}

func buildParsedRows(rawRows [][]string, hasHeader bool) ([]string, [][]string) {
	maxCols := 0
	for _, r := range rawRows {
		if len(r) > maxCols {
			maxCols = len(r)
		}
	}
	if maxCols == 0 {
		return nil, nil
	}

	if !hasHeader {
		headers := make([]string, maxCols)
		for i := 0; i < maxCols; i++ {
			headers[i] = fmt.Sprintf("Column %s", toColumnName(i))
		}
		return headers, normalizeRows(rawRows, maxCols)
	}

	headerRow := rawRows[0]
	headers := make([]string, maxCols)
	for i := 0; i < maxCols; i++ {
		val := ""
		if i < len(headerRow) {
			val = strings.TrimSpace(headerRow[i])
		}
		if val == "" {
			val = fmt.Sprintf("Column %s", toColumnName(i))
		}
		headers[i] = val
	}
	return headers, normalizeRows(rawRows[1:], maxCols)
}

func toColumnName(i int) string {
	name := ""
	for i >= 0 {
		name = string(rune('A'+(i%26))) + name
		i = i/26 - 1
	}
	return name
}

func normalizeRows(rows [][]string, width int) [][]string {
	out := make([][]string, len(rows))
	for i, r := range rows {
		norm := make([]string, width)
		copy(norm, r)
		out[i] = norm
	}
	return out
}
