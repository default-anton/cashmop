package main

import (
	"fmt"
	"strings"

	"github.com/default-anton/cashmop/internal/cashmop"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) ExportTransactionsWithDialog(startDate, endDate string, categoryIDs []int64, ownerIDs []int64, format string) (int, error) {
	defaultFilename := generateDefaultFilename(startDate, endDate, format)

	var destinationPath string
	var err error
	if isTestEnv() {
		destinationPath, err = a.testSavePath("export", format)
	} else {
		destinationPath, err = wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
			Title:           "Export Transactions",
			DefaultFilename: defaultFilename,
			Filters: []wailsRuntime.FileFilter{
				{DisplayName: format + " Files", Pattern: "*." + format},
				{DisplayName: "All Files", Pattern: "*.*"},
			},
		})
	}
	if err != nil {
		return 0, fmt.Errorf("dialog cancelled or failed: %w", err)
	}
	if destinationPath == "" {
		return 0, fmt.Errorf("no destination selected")
	}

	return a.ExportTransactions(startDate, endDate, categoryIDs, ownerIDs, format, destinationPath)
}

func generateDefaultFilename(startDate, endDate, format string) string {
	isSingleMonth := strings.HasPrefix(endDate, startDate[0:7])

	var datePart string
	if isSingleMonth {
		datePart = startDate[0:7]
	} else {
		datePart = startDate + "_to_" + endDate
	}

	return fmt.Sprintf("cashmop_%s.%s", datePart, format)
}

func (a *App) ExportTransactions(startDate, endDate string, categoryIDs []int64, ownerIDs []int64, format, destinationPath string) (int, error) {
	return a.svc.ExportTransactions(cashmop.ExportParams{
		StartDate:       startDate,
		EndDate:         endDate,
		CategoryIDs:     categoryIDs,
		OwnerIDs:        ownerIDs,
		Format:          format,
		DestinationPath: destinationPath,
	})
}
