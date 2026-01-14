package fx

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	bocBaseURL        = "https://www.bankofcanada.ca/valet/observations/"
	bocRequestTimeout = 15 * time.Second
	bocUserAgent      = "CashMop/1.0"
)

type BoCProvider struct {
	client *http.Client
}

type bocValue struct {
	V string `json:"v"`
}

type bocResponse struct {
	Observations []map[string]json.RawMessage `json:"observations"`
}

func NewBoCProvider() *BoCProvider {
	return &BoCProvider{
		client: &http.Client{Timeout: bocRequestTimeout},
	}
}

func (p *BoCProvider) BaseCurrency() string {
	return "CAD"
}

func (p *BoCProvider) Source() string {
	return "boc"
}

func (p *BoCProvider) FetchRates(ctx context.Context, quoteCurrencies []string, startDate, endDate string) (FetchResult, error) {
	quotes := normalizeQuotes(quoteCurrencies, p.BaseCurrency())
	if len(quotes) == 0 {
		return FetchResult{Rates: map[string]map[string]float64{}}, nil
	}

	series := make([]string, 0, len(quotes))
	for _, quote := range quotes {
		series = append(series, fmt.Sprintf("FX%sCAD", quote))
	}

	endpoint := bocBaseURL + strings.Join(series, ",") + "/json"
	params := url.Values{}
	params.Set("start_date", startDate)
	params.Set("end_date", endDate)
	params.Set("order_dir", "asc")
	requestURL := endpoint + "?" + params.Encode()

	req, err := http.NewRequestWithContext(ctx, "GET", requestURL, nil)
	if err != nil {
		return FetchResult{}, fmt.Errorf("create boc request: %w", err)
	}
	req.Header.Set("User-Agent", bocUserAgent)
	req.Header.Set("Accept", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return FetchResult{}, fmt.Errorf("fetch boc rates: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return FetchResult{}, fmt.Errorf("boc response %d: %s", resp.StatusCode, string(body))
	}

	var payload bocResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return FetchResult{}, fmt.Errorf("decode boc response: %w", err)
	}

	rates := make(map[string]map[string]float64)
	seen := make(map[string]bool)

	for _, obs := range payload.Observations {
		var date string
		if raw, ok := obs["d"]; ok {
			if err := json.Unmarshal(raw, &date); err != nil {
				return FetchResult{}, fmt.Errorf("decode boc date: %w", err)
			}
		}
		if date == "" {
			continue
		}

		for _, quote := range quotes {
			key := fmt.Sprintf("FX%sCAD", quote)
			raw, ok := obs[key]
			if !ok {
				continue
			}
			var val bocValue
			if err := json.Unmarshal(raw, &val); err != nil {
				return FetchResult{}, fmt.Errorf("decode boc rate: %w", err)
			}
			if strings.TrimSpace(val.V) == "" {
				continue
			}
			rate, err := strconv.ParseFloat(val.V, 64)
			if err != nil {
				return FetchResult{}, fmt.Errorf("parse boc rate: %w", err)
			}
			if _, ok := rates[date]; !ok {
				rates[date] = make(map[string]float64)
			}
			rates[date][quote] = rate
			seen[quote] = true
		}
	}

	unsupported := make([]string, 0)
	for _, quote := range quotes {
		if !seen[quote] {
			unsupported = append(unsupported, quote)
		}
	}

	return FetchResult{Rates: rates, Unsupported: unsupported}, nil
}

func normalizeQuotes(quotes []string, base string) []string {
	baseCode := strings.ToUpper(strings.TrimSpace(base))
	seen := make(map[string]bool)
	res := make([]string, 0, len(quotes))
	for _, quote := range quotes {
		code := strings.ToUpper(strings.TrimSpace(quote))
		if code == "" || code == baseCode || seen[code] {
			continue
		}
		seen[code] = true
		res = append(res, code)
	}
	return res
}
