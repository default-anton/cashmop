package brave

import (
	"strings"
	"testing"
)

func TestSearchBasic(t *testing.T) {
	results, err := Search("golang tutorial", 3)
	if err != nil {
		t.Fatalf("Search failed: %v", err)
	}

	if len(results) == 0 {
		t.Fatal("Expected at least one result, got none")
	}

	t.Logf("Found %d results", len(results))

	for i, r := range results {
		t.Logf("Result %d:", i+1)
		t.Logf("  Title: %s", r.Title)
		t.Logf("  URL: %s", r.URL)
		t.Logf("  Snippet: %s", r.Snippet)

		if r.Title == "" {
			t.Errorf("Result %d: expected non-empty title", i)
		}
		if r.URL == "" {
			t.Errorf("Result %d: expected non-empty URL", i)
		}
		if strings.Contains(r.URL, "brave.com") {
			t.Errorf("Result %d: URL should not contain brave.com", i)
		}
	}
}

func TestSearchCount(t *testing.T) {
	tests := []struct {
		name        string
		query       string
		count       int
		minExpected int
		maxExpected int
	}{
		{
			name:        "5 results",
			query:       "rust programming language",
			count:       5,
			minExpected: 1,
			maxExpected: 5,
		},
		{
			name:        "10 results",
			query:       "machine learning basics",
			count:       10,
			minExpected: 1,
			maxExpected: 10,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results, err := Search(tt.query, tt.count)
			if err != nil {
				t.Fatalf("Search failed: %v", err)
			}

			if len(results) < tt.minExpected {
				t.Errorf("Expected at least %d results, got %d", tt.minExpected, len(results))
			}
			if len(results) > tt.maxExpected {
				t.Errorf("Expected at most %d results, got %d", tt.maxExpected, len(results))
			}

			t.Logf("Query: %q | Count: %d | Got: %d results", tt.query, tt.count, len(results))
		})
	}
}
