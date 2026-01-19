package fx

import (
	"github.com/default-anton/cashmop/internal/database"
	"testing"
)

func TestSubtractDays(t *testing.T) {
	tests := []struct {
		name     string
		dateStr  string
		days     int
		expected string
	}{
		{"subtract 7 days from middle of month", "2025-12-10", 7, "2025-12-03"},
		{"subtract 7 days crossing month boundary", "2025-01-10", 7, "2025-01-03"},
		{"subtract 7 days from year start", "2025-01-10", 7, "2025-01-03"},
		{"subtract 7 days from month start", "2025-12-05", 7, "2025-11-28"},
		{"subtract 7 days crossing year boundary", "2025-01-05", 7, "2024-12-29"},
		{"invalid date returns unchanged", "invalid", 7, "invalid"},
		{"subtract 0 days", "2025-12-10", 0, "2025-12-10"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := subtractDays(tt.dateStr, tt.days)
			if got != tt.expected {
				t.Errorf("subtractDays(%q, %d) = %q, want %q", tt.dateStr, tt.days, got, tt.expected)
			}
		})
	}
}

func TestMissingRanges(t *testing.T) {
	tests := []struct {
		name     string
		txRange  database.FxDateRange
		existing database.FxDateRange
		want     []dateRange
	}{
		{
			name:     "no existing rates - fetch full tx range",
			txRange:  database.FxDateRange{StartDate: "2025-12-02", EndDate: "2025-12-10"},
			existing: database.FxDateRange{StartDate: "", EndDate: ""},
			want:     []dateRange{{start: "2025-12-02", end: "2025-12-10"}},
		},
		{
			name:     "existing rates start after tx start - fetch gap",
			txRange:  database.FxDateRange{StartDate: "2025-12-02", EndDate: "2025-12-10"},
			existing: database.FxDateRange{StartDate: "2025-12-05", EndDate: "2025-12-08"},
			want:     []dateRange{{start: "2025-12-02", end: "2025-12-05"}, {start: "2025-12-08", end: "2025-12-10"}},
		},
		{
			name:     "existing rates cover full tx range - no fetch",
			txRange:  database.FxDateRange{StartDate: "2025-12-02", EndDate: "2025-12-10"},
			existing: database.FxDateRange{StartDate: "2025-12-01", EndDate: "2025-12-11"},
			want:     []dateRange{},
		},
		{
			name:     "existing rates start before tx but end early - fetch tail",
			txRange:  database.FxDateRange{StartDate: "2025-12-05", EndDate: "2025-12-10"},
			existing: database.FxDateRange{StartDate: "2025-12-01", EndDate: "2025-12-07"},
			want:     []dateRange{{start: "2025-12-07", end: "2025-12-10"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := missingRanges(tt.txRange, tt.existing)
			if len(got) != len(tt.want) {
				t.Errorf("missingRanges() returned %d ranges, want %d", len(got), len(tt.want))
				return
			}
			for i := range got {
				if got[i].start != tt.want[i].start || got[i].end != tt.want[i].end {
					t.Errorf("range %d: got {start: %q, end: %q}, want {start: %q, end: %q}",
						i, got[i].start, got[i].end, tt.want[i].start, tt.want[i].end)
				}
			}
		})
	}
}
