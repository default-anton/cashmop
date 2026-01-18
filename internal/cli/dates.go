package cli

import (
	"fmt"
	"time"
)

const (
	dateLayout  = "2006-01-02"
	monthLayout = "2006-01"
)

func parseDate(value string) (time.Time, error) {
	date, err := time.Parse(dateLayout, value)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid date")
	}
	return date, nil
}

func parseMonth(value string) (time.Time, error) {
	date, err := time.Parse(monthLayout, value)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid month")
	}
	return date, nil
}

func lastFullMonthRange(now time.Time) (string, string) {
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	prevMonthEnd := startOfMonth.AddDate(0, 0, -1)
	prevMonthStart := time.Date(prevMonthEnd.Year(), prevMonthEnd.Month(), 1, 0, 0, 0, 0, now.Location())
	return prevMonthStart.Format(dateLayout), prevMonthEnd.Format(dateLayout)
}

func validateDateRange(start, end string) (string, string, *cliError) {
	if start == "" && end == "" {
		start, end = lastFullMonthRange(time.Now())
		return start, end, nil
	}
	if start == "" || end == "" {
		return "", "", validationError(ErrorDetail{
			Field:   "start",
			Message: "--start requires --end.",
			Hint:    "Provide both --start and --end, or omit both to default to last calendar month.",
		})
	}

	startDate, err := parseDate(start)
	if err != nil {
		return "", "", validationError(ErrorDetail{Field: "start", Message: "Invalid start date.", Hint: "Use YYYY-MM-DD."})
	}
	endDate, err := parseDate(end)
	if err != nil {
		return "", "", validationError(ErrorDetail{Field: "end", Message: "Invalid end date.", Hint: "Use YYYY-MM-DD."})
	}
	if endDate.Before(startDate) {
		return "", "", validationError(ErrorDetail{Field: "end", Message: "--end must be on or after --start.", Hint: "Ensure --end is on or after --start."})
	}
	if endDate.Sub(startDate).Hours() > 93*24 {
		return "", "", validationError(ErrorDetail{Field: "end", Message: "Date range must be 93 days or less.", Hint: "Limit the range to 93 days or less."})
	}

	return startDate.Format(dateLayout), endDate.Format(dateLayout), nil
}
