package database

import (
 "database/sql"
 "log"

 _ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB() {
 var err error
 // Creates cashflow.db in the project root for now
 DB, err = sql.Open("sqlite3", "./cashflow.db")
 if err != nil {
  log.Fatal(err)
 }

 query := `CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account TEXT NOT NULL,
        currency TEXT DEFAULT 'CAD',
        amount REAL NOT NULL,
        description TEXT,
        owner TEXT NOT NULL,
        date TEXT NOT NULL,
        category TEXT,
        raw_metadata TEXT -- For storing extra CSV columns if needed
    );
    CREATE INDEX IF NOT EXISTS idx_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_category ON transactions(category);`
    
 _, err = DB.Exec(query)
 if err != nil {
  log.Fatalf("Failed to init db: %q", err)
 }
}