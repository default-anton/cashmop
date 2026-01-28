package main

import (
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/xuri/excelize/v2"
)

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
		AllRows: rows,
	}, nil
}
