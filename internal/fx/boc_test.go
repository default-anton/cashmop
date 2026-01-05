package fx

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"
)

type httpCassette struct {
	RecordedAt string           `json:"recorded_at"`
	Request    cassetteRequest  `json:"request"`
	Response   cassetteResponse `json:"response"`
}

type cassetteRequest struct {
	Method  string              `json:"method"`
	URL     string              `json:"url"`
	Headers map[string][]string `json:"headers"`
}

type cassetteResponse struct {
	StatusCode int                 `json:"status_code"`
	Headers    map[string][]string `json:"headers"`
	Body       string              `json:"body"`
}

type cassetteTransport struct {
	cassettePath string
	record       bool
	base         http.RoundTripper
}

func (t *cassetteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if !t.record {
		cassette, err := readCassette(t.cassettePath)
		if err != nil {
			return nil, err
		}
		if req.Method != cassette.Request.Method || req.URL.String() != cassette.Request.URL {
			return nil, fmt.Errorf("cassette request mismatch: got %s %s want %s %s",
				req.Method, req.URL.String(), cassette.Request.Method, cassette.Request.URL)
		}

		body := []byte(cassette.Response.Body)
		resp := &http.Response{
			StatusCode:    cassette.Response.StatusCode,
			Status:        fmt.Sprintf("%d %s", cassette.Response.StatusCode, http.StatusText(cassette.Response.StatusCode)),
			Header:        cloneHeaders(cassette.Response.Headers),
			Body:          io.NopCloser(bytes.NewReader(body)),
			ContentLength: int64(len(body)),
			Request:       req,
		}
		return resp, nil
	}

	resp, err := t.base.RoundTrip(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	cassette := httpCassette{
		RecordedAt: time.Now().Format(time.RFC3339),
		Request: cassetteRequest{
			Method:  req.Method,
			URL:     req.URL.String(),
			Headers: cloneHeaders(req.Header),
		},
		Response: cassetteResponse{
			StatusCode: resp.StatusCode,
			Headers:    cloneHeaders(resp.Header),
			Body:       string(body),
		},
	}
	if err := writeCassette(t.cassettePath, cassette); err != nil {
		return nil, err
	}

	resp.Body = io.NopCloser(bytes.NewReader(body))
	resp.ContentLength = int64(len(body))
	return resp, nil
}

func readCassette(path string) (httpCassette, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return httpCassette{}, err
	}
	var cassette httpCassette
	if err := json.Unmarshal(data, &cassette); err != nil {
		return httpCassette{}, err
	}
	return cassette, nil
}

func writeCassette(path string, cassette httpCassette) error {
	data, err := json.MarshalIndent(cassette, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func cloneHeaders(src http.Header) map[string][]string {
	if src == nil {
		return nil
	}
	dst := make(map[string][]string, len(src))
	for key, values := range src {
		clone := make([]string, len(values))
		copy(clone, values)
		dst[key] = clone
	}
	return dst
}

func shouldRecordCassette(t *testing.T, path string) bool {
	t.Helper()
	if os.Getenv("FX_RECORD") == "1" {
		t.Logf("FX_RECORD=1 recording %s", path)
		return true
	}
	_, err := os.Stat(path)
	if err == nil {
		return false
	}
	if errors.Is(err, os.ErrNotExist) {
		t.Logf("cassette missing, recording %s", path)
		return true
	}
	t.Fatalf("stat cassette: %v", err)
	return false
}

func assertRate(t *testing.T, result FetchResult, date, quote string, want float64) {
	t.Helper()
	gotByDate, ok := result.Rates[date]
	if !ok {
		t.Fatalf("missing rates for date %s", date)
	}
	got, ok := gotByDate[quote]
	if !ok {
		t.Fatalf("missing rate for %s on %s", quote, date)
	}
	if math.Abs(got-want) > 0.0001 {
		t.Fatalf("rate mismatch for %s on %s: got %f want %f", quote, date, got, want)
	}
}

func TestBoCFetchRatesRecorded(t *testing.T) {
	cassettePath := filepath.Join("testdata", "boc_cad_usd_eur_2024-01-02_2024-01-05.json")
	record := shouldRecordCassette(t, cassettePath)
	client := &http.Client{
		Timeout:   bocRequestTimeout,
		Transport: &cassetteTransport{cassettePath: cassettePath, record: record, base: http.DefaultTransport},
	}
	provider := NewBoCProvider()
	provider.client = client

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	result, err := provider.FetchRates(ctx, []string{"USD", "EUR"}, "2024-01-02", "2024-01-05")
	if err != nil {
		t.Fatalf("FetchRates failed: %v", err)
	}
	if len(result.Unsupported) != 0 {
		t.Fatalf("unexpected unsupported currencies: %v", result.Unsupported)
	}

	assertRate(t, result, "2024-01-02", "USD", 1.3316)
	assertRate(t, result, "2024-01-02", "EUR", 1.4584)
	assertRate(t, result, "2024-01-05", "USD", 1.3347)
	assertRate(t, result, "2024-01-05", "EUR", 1.4614)
}
