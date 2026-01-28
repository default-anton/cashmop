package main

func (a *App) SearchWeb(query string) ([]WebSearchResult, error) {
	results, err := a.svc.SearchWeb(query, 5)
	if err != nil {
		return nil, err
	}
	out := make([]WebSearchResult, 0, len(results))
	for _, r := range results {
		out = append(out, WebSearchResult{
			Title:   r.Title,
			URL:     r.URL,
			Snippet: r.Snippet,
			Domain:  r.Domain,
		})
	}
	return out, nil
}
