package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"cashflow/internal/paths"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

const storageName = "cashflow"

func InitDB() {
	dbPath, err := resolveDatabasePath()
	if err != nil {
		log.Fatal(err)
	}

	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal(err)
	}

	// SQLite performs best with a single connection.
	// Multiple connections can cause locking issues with operations like VACUUM.
	DB.SetMaxOpenConns(1)

	if err := Migrate(); err != nil {
		log.Fatalf("Failed to migrate database: %q", err)
	}
}

func resolveDatabasePath() (string, error) {
	env := strings.ToLower(os.Getenv("APP_ENV"))

	switch env {
	case "test":
		return devTestPath("test")
	case "dev", "development":
		return devTestPath("dev")
	}

	dir, err := paths.AppConfigDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(dir, storageName+".db"), nil
}

func devTestPath(suffix string) (string, error) {
	root, err := projectRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, storageName+"_"+suffix+".db"), nil
}

func projectRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("get working dir: %w", err)
	}

	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("go.mod not found from %s", dir)
		}
		dir = parent
	}
}

func Close() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}

// DatabasePath returns the current database file path
func DatabasePath() (string, error) {
	return resolveDatabasePath()
}

// EnsureBackupDir creates and returns the backup directory path
func EnsureBackupDir() (string, error) {
	dir, err := backupDir()
	if err != nil {
		return "", err
	}

	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create backup directory: %w", err)
	}

	return dir, nil
}

// backupDir returns the backup directory next to the active database
func backupDir() (string, error) {
	dbPath, err := resolveDatabasePath()
	if err != nil {
		return "", err
	}
	dbDir := filepath.Dir(dbPath)
	return filepath.Join(dbDir, "backups"), nil
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
