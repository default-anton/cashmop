package brave

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

const (
	baseURL      = "https://search.brave.com/search"
	userAgent    = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
	maxResults   = 20
	requestTimeout = 15 * time.Second
)

type Result struct {
	Title   string
	URL     string
	Snippet string
}

func Search(query string, count int) ([]Result, error) {
	if count <= 0 || count > maxResults {
		count = 5
	}

	searchURL := fmt.Sprintf("%s?q=%s", baseURL, url.QueryEscape(query))

	client := &http.Client{
		Timeout: requestTimeout,
	}

	req, err := http.NewRequest("GET", searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("sec-ch-ua", `"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"`)
	req.Header.Set("sec-ch-ua-mobile", "?0")
	req.Header.Set("sec-ch-ua-platform", `"macOS"`)
	req.Header.Set("sec-fetch-dest", "document")
	req.Header.Set("sec-fetch-mode", "navigate")
	req.Header.Set("sec-fetch-site", "none")
	req.Header.Set("sec-fetch-user", "?1")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetching search results: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(body[:200]))
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("parsing HTML: %w", err)
	}

	var results []Result

	doc.Find("div.snippet[data-type='web']").EachWithBreak(func(i int, s *goquery.Selection) bool {
		if len(results) >= count {
			return false
		}

		titleLink := s.Find("a.svelte-14r20fy").First()
		if titleLink.Length() == 0 {
			return true
		}

		href, exists := titleLink.Attr("href")
		if !exists || href == "" {
			return true
		}

		if strings.Contains(href, "brave.com") {
			return true
		}

		var title string
		if titleEl := titleLink.Find(".title").First(); titleEl.Length() > 0 {
			title = strings.TrimSpace(titleEl.Text())
		} else {
			title = strings.TrimSpace(titleLink.Text())
		}

		var snippet string
		if descEl := s.Find(".generic-snippet .content").First(); descEl.Length() > 0 {
			snippet = strings.TrimSpace(descEl.Text())
		}

		snippet = strings.TrimPrefix(snippet, ": ")

		if title != "" && href != "" {
			results = append(results, Result{
				Title:   title,
				URL:     href,
				Snippet: snippet,
			})
		}

		return true
	})

	return results, nil
}
