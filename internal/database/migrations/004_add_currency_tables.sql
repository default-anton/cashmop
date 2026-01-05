CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fx_rates (
    base_currency TEXT NOT NULL,
    quote_currency TEXT NOT NULL,
    rate_date TEXT NOT NULL,
    rate REAL NOT NULL,
    source TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fx_rates_unique
    ON fx_rates(base_currency, quote_currency, rate_date, source);
