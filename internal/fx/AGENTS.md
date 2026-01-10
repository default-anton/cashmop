# internal/fx

- FX sync requires 7-day buffer before min transaction date (for weekend/holiday coverage). See `SyncRates()` implementation in `sync.go`.
- FX provider tests: record/replay cassettes in `internal/fx/testdata/`
- Re-record: `FX_RECORD=1 go test ./internal/fx -run TestBoCFetchRatesRecorded -count=1`
