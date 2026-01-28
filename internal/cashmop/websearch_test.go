package cashmop

import "testing"

func TestHashQueryDeterministic(t *testing.T) {
	q := "test query"
	if hashQuery(q) != hashQuery(q) {
		t.Fatal("expected hashQuery to be deterministic")
	}
	if hashQuery(q) == hashQuery("different") {
		t.Fatal("expected different queries to have different hashes")
	}
}

func TestSearchWeb_UsesCache(t *testing.T) {
	svc := New(nil)
	q := "cached query"
	key := hashQuery(q)
	expected := []WebSearchResult{{Title: "t", URL: "https://example.com", Snippet: "s", Domain: "example.com"}}
	svc.webSearchCache.Store(key, expected)

	got, err := svc.SearchWeb(q, 5)
	if err != nil {
		t.Fatalf("SearchWeb returned error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 result, got %d", len(got))
	}
	if got[0].URL != expected[0].URL {
		t.Fatalf("expected cached result")
	}
}
