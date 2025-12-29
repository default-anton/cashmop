PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    currency TEXT DEFAULT 'CAD',
    type TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    owner_id INTEGER,
    date TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    category_id INTEGER,
    currency TEXT DEFAULT 'CAD',
    raw_metadata TEXT,
    FOREIGN KEY(account_id) REFERENCES accounts(id),
    FOREIGN KEY(owner_id) REFERENCES users(id),
    FOREIGN KEY(category_id) REFERENCES categories(id),
    UNIQUE(account_id, date, description, amount)
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);

CREATE TABLE IF NOT EXISTS column_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    mapping_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categorization_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_type TEXT NOT NULL,
    match_value TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    amount_min REAL,
    amount_max REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id)
);

CREATE VIRTUAL TABLE IF NOT EXISTS categories_fts USING fts5(
    name,
    content='categories',
    content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS cat_after_insert AFTER INSERT ON categories BEGIN
    INSERT INTO categories_fts(rowid, name) VALUES (new.id, new.name);
END;

CREATE TRIGGER IF NOT EXISTS cat_after_delete AFTER DELETE ON categories BEGIN
    INSERT INTO categories_fts(categories_fts, rowid, name) VALUES ('delete', old.id, old.name);
END;

CREATE TRIGGER IF NOT EXISTS cat_after_update AFTER UPDATE ON categories BEGIN
    INSERT INTO categories_fts(categories_fts, rowid, name) VALUES ('delete', old.id, old.name);
    INSERT INTO categories_fts(rowid, name) VALUES (new.id, new.name);
END;
