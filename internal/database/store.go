package database

import (
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/default-anton/cashmop/internal/paths"

	_ "modernc.org/sqlite"
)

type Store struct {
	db       *sql.DB
	dsnBase  string
	filePath string
	logger   *slog.Logger

	fxRateCache   map[string]*FxRateLookup
	fxRateCacheMu sync.RWMutex

	categoryCacheMu sync.RWMutex
	categoryCache   []Category

	backupMu sync.Mutex
}

const (
	storageName          = "cashmop"
	sqliteBusyTimeoutMs  = 5000
	sqliteJournalModeWal = "WAL"
)

func Open(path string, logger *slog.Logger) (store *Store, err error) {
	l := logger
	if l == nil {
		l = slog.Default()
	}

	dsnBase := strings.TrimSpace(path)
	if dsnBase == "" {
		resolved, rErr := ResolveDatabasePath()
		if rErr != nil {
			return nil, rErr
		}
		dsnBase = resolved
	}

	filePath := filePathFromDSN(dsnBase)
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		return nil, fmt.Errorf("create database directory: %w", err)
	}

	db, err := sql.Open("sqlite", sqliteDSN(dsnBase))
	if err != nil {
		return nil, err
	}
	// Keep closed on migration failure.
	defer func() {
		if err != nil {
			_ = db.Close()
		}
	}()

	db.SetMaxOpenConns(4)

	store = &Store{
		db:          db,
		dsnBase:     dsnBase,
		filePath:    filePath,
		logger:      l,
		fxRateCache: make(map[string]*FxRateLookup),
	}

	if mErr := store.Migrate(); mErr != nil {
		err = fmt.Errorf("failed to migrate database: %w", mErr)
		return nil, err
	}

	return store, nil
}

func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	err := s.db.Close()
	s.db = nil
	return err
}

// DB exposes the underlying *sql.DB. Prefer Store methods; intended for tests/tooling.
func (s *Store) DB() *sql.DB {
	if s == nil {
		return nil
	}
	return s.db
}

func (s *Store) Path() string {
	if s == nil {
		return ""
	}
	return s.filePath
}

func (s *Store) EnsureBackupDir() (string, error) {
	dir := filepath.Join(filepath.Dir(s.filePath), "backups")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create backup directory: %w", err)
	}
	return dir, nil
}

func sqliteDSN(path string) string {
	pragmas := fmt.Sprintf("_pragma=busy_timeout(%d)&_pragma=journal_mode(%s)", sqliteBusyTimeoutMs, sqliteJournalModeWal)
	if strings.Contains(path, "?") {
		return path + "&" + pragmas
	}
	return path + "?" + pragmas
}

func filePathFromDSN(path string) string {
	if idx := strings.Index(path, "?"); idx != -1 {
		return path[:idx]
	}
	return path
}

func ResolveDatabasePath() (string, error) {
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
	return filepath.Join(root, "tmp", storageName+"_"+suffix+".db"), nil
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
