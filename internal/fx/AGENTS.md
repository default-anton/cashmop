# internal/fx

- FX provider tests must use record/replay cassettes saved under `internal/fx/testdata/`.
- Re-record cassettes by running `FX_RECORD=1 go test ./internal/fx -run TestBoCFetchRatesRecorded -count=1`.
