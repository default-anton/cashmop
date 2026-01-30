package main

import (
	"encoding/base64"
	"fmt"
	"os"
	"strings"

	"github.com/extrame/xls"
	"github.com/xuri/excelize/v2"
)

// ParseExcel parses base64-encoded Excel data (XLSX or XLS format)
func (a *App) ParseExcel(base64Data string) (*ExcelData, error) {
	data, err := decodeBase64Data(base64Data)
	if err != nil {
		return nil, err
	}

	fileType := detectExcelFileType(data)

	var rows [][]string
	switch fileType {
	case fileTypeXLSX:
		rows, err = parseXLSXData(data)
	case fileTypeXLS:
		rows, err = parseXLSData(data)
	default:
		return nil, fmt.Errorf("Unable to read the Excel file. Unsupported format or corrupted file.")
	}
	if err != nil {
		return nil, err
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf("The Excel file is empty. Please choose a file with data.")
	}

	return buildExcelData(rows), nil
}

// File type constants for Excel format detection
type excelFileType int

const (
	fileTypeUnknown excelFileType = iota
	fileTypeXLSX
	fileTypeXLS
)

// detectExcelFileType identifies Excel format by file signature
func detectExcelFileType(data []byte) excelFileType {
	// XLSX: ZIP signature "PK" (0x50 0x4B)
	if len(data) >= 2 && data[0] == 0x50 && data[1] == 0x4B {
		return fileTypeXLSX
	}
	// XLS: OLE2 signature (0xD0 0xCF 0x11 0xE0)
	if len(data) >= 8 && data[0] == 0xD0 && data[1] == 0xCF && data[2] == 0x11 && data[3] == 0xE0 {
		return fileTypeXLS
	}
	return fileTypeUnknown
}

// decodeBase64Data extracts and decodes base64 data from data URL format
func decodeBase64Data(base64Data string) ([]byte, error) {
	if idx := strings.Index(base64Data, ";base64,"); idx != -1 {
		base64Data = base64Data[idx+8:]
	}

	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return nil, fmt.Errorf("Unable to read the Excel file. The file may be corrupted.")
	}
	return data, nil
}

// parseXLSXData parses XLSX (Office Open XML) format from byte slice
func parseXLSXData(data []byte) ([][]string, error) {
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

	return rows, nil
}

// parseXLSData parses XLS (Excel 97-2003 binary) format from byte slice
func parseXLSData(data []byte) ([][]string, error) {
	tmpFile, err := os.CreateTemp("", "cashmop-*.xls")
	if err != nil {
		return nil, fmt.Errorf("Unable to process .xls file: %w", err)
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.Write(data); err != nil {
		tmpFile.Close()
		return nil, fmt.Errorf("Unable to process .xls file: %w", err)
	}
	tmpFile.Close()

	wb, err := xls.Open(tmpFile.Name(), "utf-8")
	if err != nil {
		return nil, fmt.Errorf("Unable to read the .xls file. Please check if it's corrupted or password-protected.")
	}

	sheet := wb.GetSheet(0)
	if sheet == nil {
		return nil, fmt.Errorf("The .xls file doesn't contain any data sheets.")
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

	return rows, nil
}

// buildExcelData creates ExcelData from raw rows with trimming and normalization
func buildExcelData(rows [][]string) *ExcelData {
	// Trim all cells
	for i := range rows {
		for j := range rows[i] {
			rows[i][j] = strings.TrimSpace(rows[i][j])
		}
	}

	headers := rows[0]
	var dataRows [][]string
	if len(rows) > 1 {
		dataRows = rows[1:]
	} else {
		dataRows = [][]string{}
	}

	// Trim headers
	for i, h := range headers {
		headers[i] = strings.TrimSpace(h)
	}

	// Normalize row widths to match header count
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
		AllRows: rows,
	}
}
