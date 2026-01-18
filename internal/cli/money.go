package cli

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

var amountCleanupRegex = regexp.MustCompile(`[^0-9.-]`)

func parseCentsString(value string) (int64, error) {
	cleaned := strings.TrimSpace(value)
	if cleaned == "" {
		return 0, fmt.Errorf("empty amount")
	}
	cleaned = strings.Map(func(r rune) rune {
		switch {
		case r >= '0' && r <= '9':
			return r
		case r == '-' || r == '.' || r == ',':
			return r
		default:
			return -1
		}
	}, cleaned)
	cleaned = strings.ReplaceAll(cleaned, ",", ".")
	if cleaned == "" || cleaned == "-" || cleaned == "." || cleaned == "-." {
		return 0, fmt.Errorf("invalid amount")
	}
	val, err := strconv.ParseFloat(cleaned, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid amount")
	}
	return int64(math.Floor(val*100 + 0.5)), nil
}

func formatCentsDecimal(cents int64) string {
	return fmt.Sprintf("%.2f", float64(cents)/100)
}
