package fx

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

var ErrProviderUnsupported = errors.New("fx provider unsupported")

type FetchResult struct {
	Rates       map[string]map[string]float64
	Unsupported []string
}

type Provider interface {
	BaseCurrency() string
	Source() string
	FetchRates(ctx context.Context, quoteCurrencies []string, startDate, endDate string) (FetchResult, error)
}

func ProviderForBase(baseCurrency string) (Provider, error) {
	base := strings.ToUpper(strings.TrimSpace(baseCurrency))
	switch base {
	case "CAD":
		return NewBoCProvider(), nil
	default:
		return nil, fmt.Errorf("%w: %s", ErrProviderUnsupported, base)
	}
}
