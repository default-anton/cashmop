package cli

import (
	"fmt"
	"strings"

	"github.com/default-anton/cashmop/internal/cashmop"
)

type exportResponse struct {
	Ok    bool   `json:"ok"`
	Count int    `json:"count"`
	Path  string `json:"path"`
}

func handleExport(svc *cashmop.Service, args []string) commandResult {
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

	format = strings.ToLower(strings.TrimSpace(format))
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

	count, err := svc.ExportTransactions(cashmop.ExportParams{
		StartDate:       start,
		EndDate:         end,
		CategoryIDs:     catIDs,
		Format:          format,
		DestinationPath: out,
	})
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: exportResponse{Ok: true, Count: count, Path: out}}
}
