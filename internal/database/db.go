package database

import (
	"database/sql"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB() {
	// Check if db exists, if so, we might want to wipe it since we are in dev and changing schema
	var err error
	DB, err = sql.Open("sqlite3", "./cashflow.db")
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

	CREATE TABLE IF NOT EXISTS transactions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		account_id INTEGER NOT NULL,
		owner_id INTEGER,
		date TEXT NOT NULL,
		description TEXT,
		amount REAL NOT NULL,
		category TEXT,
		currency TEXT DEFAULT 'CAD',
		raw_metadata TEXT,
		FOREIGN KEY(account_id) REFERENCES accounts(id),
		FOREIGN KEY(owner_id) REFERENCES users(id)
	);

	CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
	CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
	`

	_, err = DB.Exec(createTables)
	if err != nil {
		log.Fatalf("Failed to init db: %q", err)
	}
}
