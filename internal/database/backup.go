package database

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"
)

var backupMu sync.Mutex

type BackupMetadata struct {
	Path             string    `json:"path"`
	Size             int64     `json:"size"`
	TransactionCount int64     `json:"transaction_count"`
	CreatedAt        time.Time `json:"created_at"`
}

func CreateBackup(destination string) error {
	backupMu.Lock()
	defer backupMu.Unlock()

	return createBackupUnsafe(destination)
}

func CreateAutoBackup() (string, error) {
	backupDir, err := EnsureBackupDir()
	if err != nil {
		return "", err
	}

	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("cashmop_backup_%s.db", timestamp)
	backupPath := filepath.Join(backupDir, filename)

	if err := CreateBackup(backupPath); err != nil {
		return "", err
	}

	go func() { _ = CleanupOldBackups() }()

	return backupPath, nil
}

func ValidateBackup(path string) (int64, error) {
	info, err := os.Stat(path)
	if err != nil {
		return 0, fmt.Errorf("Cannot access the backup file: %s", err.Error())
	}

	db, err := sql.Open("sqlite", path+"?mode=ro&_pragma=busy_timeout(5000)")
	if err != nil {
		return 0, fmt.Errorf("This is not a valid backup file.")
	}
	defer db.Close()

	if err := ensureIntegrity(db); err != nil {
		return 0, err
	}

	if err := ensureHasTransactionsTable(db); err != nil {
		return 0, err
	}

	backupVersion, err := schemaVersion(db)
	if err != nil {
		return 0, err
	}
	currentVersion, err := CurrentSchemaVersion()
	if err != nil {
		return 0, err
	}
	if backupVersion != currentVersion {
		return 0, fmt.Errorf("This backup was created with a different version of the app and cannot be restored.")
	}

	var count int64
	if err := db.QueryRow("SELECT COUNT(*) FROM transactions").Scan(&count); err != nil {
		return 0, fmt.Errorf("Unable to read the backup file.")
	}

	if info.Size() == 0 {
		return 0, fmt.Errorf("The backup file is empty.")
	}

	return count, nil
}

func RestoreBackup(backupPath string) error {
	_, err := RestoreBackupWithSafety(backupPath)
	return err
}

func RestoreBackupWithSafety(backupPath string) (string, error) {
	backupMu.Lock()
	defer backupMu.Unlock()

	txCount, err := ValidateBackup(backupPath)
	if err != nil {
		return "", err
	}
	if txCount == 0 {
		return "", fmt.Errorf("The backup file contains no transactions.")
	}

	currentDBPath, err := DatabasePath()
	if err != nil {
		return "", fmt.Errorf("Unable to access the database.")
	}

	backupDir, err := EnsureBackupDir()
	if err != nil {
		return "", fmt.Errorf("Unable to access the backup folder.")
	}

	safetyBackupPath := filepath.Join(backupDir, fmt.Sprintf("cashmop_pre_restore_%s.db", time.Now().Format("20060102_150405")))
	if err := createBackupUnsafe(safetyBackupPath); err != nil {
		return "", fmt.Errorf("Unable to create a safety backup before restoring.")
	}

	if err := Close(); err != nil {
		return "", fmt.Errorf("Unable to prepare the database for restore.")
	}

	tempPath := currentDBPath + ".tmp"
	if err := copyFile(backupPath, tempPath); err != nil {
		return "", fmt.Errorf("Unable to copy the backup file.")
	}

	if err := os.Rename(tempPath, currentDBPath); err != nil {
		return "", fmt.Errorf("Unable to restore the backup file.")
	}

	var openErr error
	DB, openErr = sql.Open("sqlite", sqliteDSN(currentDBPath))
	if openErr != nil {
		return "", fmt.Errorf("Unable to reopen the database after restore.")
	}

	return safetyBackupPath, nil
}

func GetLastBackupTime() (time.Time, error) {
	backupDir, err := EnsureBackupDir()
	if err != nil {
		return time.Time{}, err
	}

	entries, err := os.ReadDir(backupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return time.Time{}, nil
		}
		return time.Time{}, err
	}

	var latestMod time.Time
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasPrefix(name, "cashmop_backup_") && strings.HasSuffix(name, ".db") {
			info, err := entry.Info()
			if err != nil {
				continue
			}
			if info.ModTime().After(latestMod) {
				latestMod = info.ModTime()
			}
		}
	}

	return latestMod, nil
}

func ShouldAutoBackup() (bool, error) {
	lastBackup, err := GetLastBackupTime()
	if err != nil {
		return false, err
	}

	if lastBackup.IsZero() {
		return true, nil
	}

	return time.Since(lastBackup) >= 24*time.Hour, nil
}

func CleanupOldBackups() error {
	backupDir, err := EnsureBackupDir()
	if err != nil {
		return err
	}

	entries, err := os.ReadDir(backupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	type backupInfo struct {
		name    string
		modTime time.Time
	}

	var backups []backupInfo
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasPrefix(name, "cashmop_backup_") && strings.HasSuffix(name, ".db") {
			info, err := entry.Info()
			if err != nil {
				continue
			}
			backups = append(backups, backupInfo{name: name, modTime: info.ModTime()})
		}
	}

	if len(backups) == 0 {
		return nil
	}

	sort.Slice(backups, func(i, j int) bool {
		return backups[i].modTime.After(backups[j].modTime)
	})

	keep := make(map[string]bool)
	for i := 0; i < len(backups) && i < 10; i++ {
		keep[backups[i].name] = true
	}

	weeksKept := 0
	seenWeeks := make(map[string]bool)
	for _, b := range backups {
		y, w := b.modTime.ISOWeek()
		key := fmt.Sprintf("%d-%d", y, w)
		if seenWeeks[key] {
			continue
		}
		seenWeeks[key] = true
		if weeksKept < 5 {
			keep[b.name] = true
			weeksKept++
		}
	}

	for _, b := range backups {
		if !keep[b.name] {
			_ = os.Remove(filepath.Join(backupDir, b.name))
		}
	}

	return nil
}

func CreatePreMigrationBackup(version int64) (string, error) {
	backupDir, err := EnsureBackupDir()
	if err != nil {
		return "", err
	}

	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("cashmop_pre_migration_v%03d_%s.db", version, timestamp)
	backupPath := filepath.Join(backupDir, filename)

	if err := CreateBackup(backupPath); err != nil {
		return "", fmt.Errorf("Unable to create a backup before update.")
	}

	return backupPath, nil
}

func createBackupUnsafe(destination string) error {
	if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
		return fmt.Errorf("Unable to create backup folder: %s", err.Error())
	}

	dbPath, err := DatabasePath()
	if err != nil {
		return err
	}

	dbInfo, err := os.Stat(dbPath)
	if err != nil {
		return fmt.Errorf("Unable to access the database.")
	}

	hasSpace, err := hasSufficientSpace(destination, dbInfo.Size())
	if err != nil {
		return err
	}
	if !hasSpace {
		return fmt.Errorf("Not enough disk space to create a backup.")
	}

	if err := vacuumWithRetry(destination); err != nil {
		return fmt.Errorf("Unable to create the backup file.")
	}

	if _, err := os.Stat(destination); err != nil {
		return fmt.Errorf("Backup was not created successfully.")
	}

	if _, err := ValidateBackup(destination); err != nil {
		_ = os.Remove(destination)
		return fmt.Errorf("Backup verification failed.")
	}

	return nil
}

func vacuumWithRetry(destination string) error {
	escaped := strings.ReplaceAll(destination, "'", "''")
	start := time.Now()
	backoff := 200 * time.Millisecond

	for {
		_, err := DB.Exec(fmt.Sprintf("VACUUM INTO '%s'", escaped))
		if err == nil {
			return nil
		}

		if !isBusyError(err) || time.Since(start) > 30*time.Second {
			return err
		}

		time.Sleep(backoff)
		if backoff < 2*time.Second {
			backoff *= 2
		}
	}
}

func ensureIntegrity(db *sql.DB) error {
	var res string
	if err := db.QueryRow("PRAGMA integrity_check").Scan(&res); err != nil {
		return fmt.Errorf("The backup file appears to be corrupted.")
	}
	if !strings.EqualFold(strings.TrimSpace(res), "ok") {
		return fmt.Errorf("The backup file appears to be corrupted.")
	}
	return nil
}

func ensureHasTransactionsTable(db *sql.DB) error {
	var tableName string
	err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'").Scan(&tableName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("This is not a valid CashMop backup file.")
		}
		return fmt.Errorf("Unable to read the backup file.")
	}
	return nil
}

func schemaVersion(db *sql.DB) (int64, error) {
	var version sql.NullInt64
	err := db.QueryRow("SELECT MAX(version) FROM schema_migrations").Scan(&version)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "no such table") {
			return 0, nil
		}
		return 0, fmt.Errorf("Unable to read the backup file.")
	}
	if !version.Valid {
		return 0, nil
	}
	return version.Int64, nil
}

func CurrentSchemaVersion() (int64, error) {
	if DB == nil {
		return 0, fmt.Errorf("Database not ready. Please restart the application.")
	}
	return schemaVersion(DB)
}

func copyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	if _, err := io.Copy(dstFile, srcFile); err != nil {
		return err
	}

	return dstFile.Sync()
}

func hasSufficientSpace(destPath string, required int64) (bool, error) {
	dir := destPath
	if fi, err := os.Stat(destPath); err == nil && fi.IsDir() {
		dir = destPath
	} else {
		dir = filepath.Dir(destPath)
	}

	var stat syscall.Statfs_t
	if err := syscall.Statfs(dir, &stat); err != nil {
		return true, nil // best effort; assume enough space if unknown
	}
	available := int64(stat.Bavail) * int64(stat.Bsize)
	return available > required, nil
}

func isBusyError(err error) bool {
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "locked") || strings.Contains(msg, "busy")
}
