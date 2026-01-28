package cashmop

import (
	"crypto/sha256"
	"fmt"
	"net/url"
	"strings"

	"github.com/default-anton/cashmop/internal/brave"
)

type WebSearchResult struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
	Domain  string `json:"domain"`
}

func hashQuery(query string) string {
	h := sha256.Sum256([]byte(query))
	return fmt.Sprintf("%x", h)[:16]
}

func (s *Service) SearchWeb(query string, count int) ([]WebSearchResult, error) {
	q := strings.TrimSpace(query)
	if q == "" {
		return nil, fmt.Errorf("Please enter a search term.")
	}

	cacheKey := hashQuery(q)
	if cached, ok := s.webSearchCache.Load(cacheKey); ok {
		return cached.([]WebSearchResult), nil
	}

	results, err := brave.Search(q, count)
	if err != nil {
		return nil, err
	}

	webResults := make([]WebSearchResult, 0, len(results))
	for _, r := range results {
		domain := ""
		if u, err := url.Parse(r.URL); err == nil {
			domain = u.Hostname()
		}

		webResults = append(webResults, WebSearchResult{
			Title:   r.Title,
			URL:     r.URL,
			Snippet: r.Snippet,
			Domain:  domain,
		})
	}

	s.webSearchCache.Store(cacheKey, webResults)

	return webResults, nil
}
