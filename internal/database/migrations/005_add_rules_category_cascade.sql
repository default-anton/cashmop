PRAGMA foreign_keys = OFF;

ALTER TABLE categorization_rules RENAME TO categorization_rules_old;

CREATE TABLE IF NOT EXISTS categorization_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_type TEXT NOT NULL,
    match_value TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    amount_min INTEGER,
    amount_max INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
);

INSERT INTO categorization_rules (id, match_type, match_value, category_id, amount_min, amount_max, created_at)
SELECT id, match_type, match_value, category_id, amount_min, amount_max, created_at
FROM categorization_rules_old;

DROP TABLE categorization_rules_old;

PRAGMA foreign_keys = ON;
