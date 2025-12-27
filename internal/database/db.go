package database

import (
	"database/sql"
	_ "embed"
	"log"
	"os"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var SchemaSQL string

var DB *sql.DB

func InitDB() {
	dbPath := "./cashflow.db"
	if os.Getenv("APP_ENV") == "test" {
		dbPath = "./cashflow_test.db"
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal(err)
	}

	if _, err := DB.Exec(SchemaSQL); err != nil {
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
