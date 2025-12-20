package database

import (
	"database/sql"
	"log"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func InitDB() {
	// Check if db exists, if so, we might want to wipe it since we are in dev and changing schema
	var err error
	DB, err = sql.Open("sqlite", "./cashflow.db")
	if err != nil {
		log.Fatal(err)
	}

	if _, err := DB.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		log.Fatal(err)
	}

	createTables := `
	CREATE TABLE IF NOT EXISTS accounts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL UNIQUE,
		currency TEXT DEFAULT 'CAD',
		type TEXT -- 'credit_card', 'checking', etc.
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
		match_type TEXT NOT NULL, -- 'contains', 'starts_with', 'ends_with', 'exact'
		match_value TEXT NOT NULL,
		category_id INTEGER NOT NULL,
		amount_min REAL,
		amount_max REAL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(category_id) REFERENCES categories(id)
	);

	-- Categories FTS for fast search and BM25 ranking
	CREATE VIRTUAL TABLE IF NOT EXISTS categories_fts USING fts5(
		name,
		content='categories',
		content_rowid='id'
	);

	-- Triggers to keep categories_fts in sync
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
	`

	_, err = DB.Exec(createTables)
	if err != nil {
		log.Fatalf("Failed to init db: %q", err)
	}
}

type ColumnMappingModel struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	MappingJSON string `json:"mapping_json"`
}

func GetColumnMappings() ([]ColumnMappingModel, error) {
	rows, err := DB.Query("SELECT id, name, mapping_json FROM column_mappings ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var mappings []ColumnMappingModel
	for rows.Next() {
		var m ColumnMappingModel
		if err := rows.Scan(&m.ID, &m.Name, &m.MappingJSON); err != nil {
			return nil, err
		}
		mappings = append(mappings, m)
	}
	return mappings, nil
}

func SaveColumnMapping(name string, mappingJSON string) (int64, error) {
	// Upsert based on name
	res, err := DB.Exec(`
		INSERT INTO column_mappings (name, mapping_json) 
		VALUES (?, ?) 
		ON CONFLICT(name) DO UPDATE SET mapping_json=excluded.mapping_json`,
		name, mappingJSON,
	)
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		// If it was an update, LastInsertId might not be what we expect or needed,
		// but typically we just reload or rely on name.
		// Let's try to get ID if 0.
		var existingID int64
		err2 := DB.QueryRow("SELECT id FROM column_mappings WHERE name = ?", name).Scan(&existingID)
		if err2 == nil {
			return existingID, nil
		}
		return 0, err
	}
	return id, nil
}

func DeleteColumnMapping(id int64) error {
	_, err := DB.Exec("DELETE FROM column_mappings WHERE id = ?", id)
	return err
}
