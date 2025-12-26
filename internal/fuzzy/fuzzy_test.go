package fuzzy

import (
	"reflect"
	"testing"
)

func TestMatch(t *testing.T) {
	tests := []struct {
		name     string
		query    string
		items    []string
		expected []string
	}{
		{
			name:     "basic match",
			query:    "cr",
			items:    []string{"Car", "Subscription", "Grocery"},
			expected: []string{"Car", "Subscription", "Grocery"},
		},
		{
			name:     "case insensitivity",
			query:    "CAR",
			items:    []string{"car", "Car", "CAR"},
			expected: []string{"car", "Car", "CAR"},
		},
		{
			name:     "no match",
			query:    "xyz",
			items:    []string{"Car", "Grocery"},
			expected: []string{},
		},
		{
			name:     "empty query",
			query:    "",
			items:    []string{"Car", "Grocery"},
			expected: []string{"Car", "Grocery"},
		},
		{
			name:     "ranking",
			query:    "sub",
			items:    []string{"Subscription", "Subway"},
			expected: []string{"Subway", "Subscription"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Match(tt.query, tt.items)
			if !reflect.DeepEqual(got, tt.expected) {
				t.Errorf("Match(%q, %v) = %v, want %v", tt.query, tt.items, got, tt.expected)
			}
		})
	}
}
