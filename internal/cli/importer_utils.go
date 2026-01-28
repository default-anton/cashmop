package cli

import (
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/default-anton/cashmop/internal/mapping"
)

func createAmountParser(mapping mapping.ImportMapping, headers []string) func([]string) int64 {
	colIdx := func(col string) int {
		if col == "" {
			return -1
		}
		for i, h := range headers {
			if h == col {
				return i
			}
		}
		return -1
	}

	am := mapping.CSV.AmountMapping
	invert := am.InvertSign

	if am.Type == "single" {
		idx := colIdx(am.Column)
		return func(row []string) int64 {
			if idx == -1 || idx >= len(row) {
				return 0
			}
			cents, _ := parseCentsString(row[idx])
			if invert {
				return -cents
			}
			return cents
		}
	}

	if am.Type == "debitCredit" {
		debitIdx := colIdx(am.DebitColumn)
		creditIdx := colIdx(am.CreditColumn)
		return func(row []string) int64 {
			var debit, credit int64
			if debitIdx != -1 && debitIdx < len(row) {
				debit, _ = parseCentsString(row[debitIdx])
			}
			if creditIdx != -1 && creditIdx < len(row) {
				credit, _ = parseCentsString(row[creditIdx])
			}
			// parseCentsString returns signed.
			// spec says "amount = math.Abs(credit) - math.Abs(debit)"
			// wait, if I use parseCentsString, it might already have the sign.
			// Let's stick to the spec's abs logic to be safe if input has mixed signs.
			absDebit := int64(math.Abs(float64(debit)))
			absCredit := int64(math.Abs(float64(credit)))
			cents := absCredit - absDebit
			if invert {
				return -cents
			}
			return cents
		}
	}

	if am.Type == "amountWithType" {
		amountIdx := colIdx(am.AmountColumn)
		typeIdx := colIdx(am.TypeColumn)
		neg := strings.TrimSpace(strings.ToLower(am.NegativeValue))
		if neg == "" {
			neg = "debit"
		}
		pos := strings.TrimSpace(strings.ToLower(am.PositiveValue))
		if pos == "" {
			pos = "credit"
		}

		return func(row []string) int64 {
			if amountIdx == -1 || amountIdx >= len(row) {
				return 0
			}
			valCents, _ := parseCentsString(row[amountIdx])

			typeVal := ""
			if typeIdx != -1 && typeIdx < len(row) {
				typeVal = strings.TrimSpace(strings.ToLower(row[typeIdx]))
			}

			abs := int64(math.Abs(float64(valCents)))
			cents := valCents
			if typeVal != "" {
				if typeVal == neg {
					cents = -abs
				} else if typeVal == pos {
					cents = abs
				}
			}

			if invert {
				return -cents
			}
			return cents
		}
	}

	return func(row []string) int64 { return 0 }
}

func parseDateLoose(value string) time.Time {
	v := strings.TrimSpace(value)
	if v == "" {
		return time.Time{}
	}

	// Date(1234567890000) or /Date(1234567890000)/
	dateRegex := regexp.MustCompile(`Date\((\d+)\)`)
	if match := dateRegex.FindStringSubmatch(v); match != nil {
		ms, _ := strconv.ParseInt(match[1], 10, 64)
		return time.Unix(ms/1000, (ms%1000)*1000000).UTC()
	}

	// ISO-ish: YYYY-MM-DD
	if matched, _ := regexp.MatchString(`^\d{4}-\d{2}-\d{2}`, v); matched {
		d, err := time.Parse("2006-01-02", v[:10])
		if err == nil {
			return d
		}
	}

	// Common bank formats: MM/DD/YYYY or DD/MM/YYYY
	re := regexp.MustCompile(`^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$`)
	slash := re.FindStringSubmatch(v)
	if slash != nil {
		a, _ := strconv.Atoi(slash[1])
		b, _ := strconv.Atoi(slash[2])
		year, _ := strconv.Atoi(slash[3])
		if year < 100 {
			year += 2000
		}

		// Heuristic: If first is > 12, it must be day.
		// If both <= 12, assume MM/DD.
		month := a
		day := b
		if a > 12 && b <= 12 {
			month = b
			day = a
		}

		d := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.Local)
		return d
	}

	// MMM DD, YYYY or similar
	layouts := []string{
		"Jan 02, 2006",
		"02 Jan 2006",
		"January 02, 2006",
		"02 January 2006",
	}
	for _, l := range layouts {
		if d, err := time.Parse(l, v); err == nil {
			return d
		}
	}

	return time.Time{}
}
