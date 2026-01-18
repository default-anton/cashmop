package database

import (
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"cashmop/internal/paths"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

var logger *slog.Logger = slog.Default()

func SetLogger(l *slog.Logger) {
	if l != nil {
		logger = l
	}
}

const (
	storageName          = "cashmop"
	sqliteBusyTimeoutMs  = 5000
	sqliteJournalModeWal = "WAL"
)

func InitDB(l *slog.Logger) {
	if err := InitDBWithPath("", l); err != nil {
		logger.Error("Failed to initialize database", "error", err)
		os.Exit(1)
	}
}

func InitDBWithPath(path string, l *slog.Logger) error {
	SetLogger(l)
	dbPath := path
	if dbPath == "" {
		resolved, err := resolveDatabasePath()
		if err != nil {
			return err
		}
		dbPath = resolved
	}

	var err error
	DB, err = sql.Open("sqlite", sqliteDSN(dbPath))
	if err != nil {
		return err
	}

	DB.SetMaxOpenConns(4)

	if err := Migrate(); err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}
	return nil
}

func sqliteDSN(path string) string {
	pragmas := fmt.Sprintf("_pragma=busy_timeout(%d)&_pragma=journal_mode(%s)", sqliteBusyTimeoutMs, sqliteJournalModeWal)
	if strings.Contains(path, "?") {
		return path + "&" + pragmas
	}
	return path + "?" + pragmas
}

func resolveDatabasePath() (string, error) {
	env := strings.ToLower(os.Getenv("APP_ENV"))
	workerID := os.Getenv("CASHMOP_WORKER_ID")

	switch env {
	case "test":
		suffix := "test"
		if workerID != "" {
			suffix = fmt.Sprintf("test_w%s", workerID)
		}
		return devTestPath(suffix)
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

func DatabasePath() (string, error) {
	return resolveDatabasePath()
}

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

type AmountMapping struct {
	Type          string `json:"type"` // single, debitCredit, amountWithType
	Column        string `json:"column,omitempty"`
	DebitColumn   string `json:"debitColumn,omitempty"`
	CreditColumn  string `json:"creditColumn,omitempty"`
	AmountColumn  string `json:"amountColumn,omitempty"`
	TypeColumn    string `json:"typeColumn,omitempty"`
	NegativeValue string `json:"negativeValue,omitempty"`
	PositiveValue string `json:"positiveValue,omitempty"`
	InvertSign    bool   `json:"invertSign,omitempty"`
}

type ImportMapping struct {
	CSV struct {
		Date          string        `json:"date"`
		Description   []string      `json:"description"`
		AmountMapping AmountMapping `json:"amountMapping"`
		Owner         string        `json:"owner,omitempty"`
		Account       string        `json:"account,omitempty"`
		Currency      string        `json:"currency,omitempty"`
	} `json:"csv"`
	Account         string `json:"account"`
	DefaultOwner    string `json:"defaultOwner,omitempty"`
	CurrencyDefault string `json:"currencyDefault"`
}

func GetColumnMappings() ([]ColumnMappingModel, error) {
	rows, err := DB.Query("SELECT id, name, mapping_json FROM column_mappings ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	mappings := []ColumnMappingModel{}
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
		// If it was an update, LastInsertId might be 0.
		var existingID int64
		err2 := DB.QueryRow("SELECT id FROM column_mappings WHERE name = ?", name).Scan(&existingID)
		if err2 == nil {
			return existingID, nil
		}
		return 0, err
	}
	return id, nil
}

func GetColumnMappingByID(id int64) (*ColumnMappingModel, error) {
	var m ColumnMappingModel
	err := DB.QueryRow("SELECT id, name, mapping_json FROM column_mappings WHERE id = ?", id).Scan(&m.ID, &m.Name, &m.MappingJSON)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func GetColumnMappingByName(name string) (*ColumnMappingModel, error) {
	var m ColumnMappingModel
	err := DB.QueryRow("SELECT id, name, mapping_json FROM column_mappings WHERE name = ?", name).Scan(&m.ID, &m.Name, &m.MappingJSON)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func DeleteColumnMapping(id int64) error {
	_, err := DB.Exec("DELETE FROM column_mappings WHERE id = ?", id)
	return err
}
