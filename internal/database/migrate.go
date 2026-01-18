package database

import (
	"embed"
	"fmt"
	"os"
	"sort"
	"strings"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

func dbLog(format string, v ...interface{}) {
	logger.Info(fmt.Sprintf(format, v...))
}

func createMigrationsTable() error {
	_, err := DB.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)
	`)
	return err
}

func getAppliedVersions() (map[int64]bool, error) {
	rows, err := DB.Query("SELECT version FROM schema_migrations")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[int64]bool)
	for rows.Next() {
		var v int64
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		applied[v] = true
	}
	return applied, nil
}

func runMigration(version int64, sql string) error {
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(sql); err != nil {
		return fmt.Errorf("Database update failed: %s", err.Error())
	}

	if _, err := tx.Exec("INSERT INTO schema_migrations (version) VALUES (?)", version); err != nil {
		return fmt.Errorf("Database update failed: %s", err.Error())
	}

	return tx.Commit()
}

func runDownMigration(version int64, sql string) error {
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(sql); err != nil {
		return fmt.Errorf("Unable to undo the database update: %s", err.Error())
	}

	if _, err := tx.Exec("DELETE FROM schema_migrations WHERE version = ?", version); err != nil {
		return fmt.Errorf("Unable to undo the database update: %s", err.Error())
	}

	return tx.Commit()
}

func Rollback() error {
	if err := createMigrationsTable(); err != nil {
		return fmt.Errorf("Unable to access the database.")
	}

	applied, err := getAppliedVersions()
	if err != nil {
		return fmt.Errorf("Unable to access the database.")
	}

	if len(applied) == 0 {
		return fmt.Errorf("No updates can be undone.")
	}

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("Unable to access the database.")
	}

	var migrationFiles []struct {
		version int64
		name    string
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), "_down.sql") {
			continue
		}

		var version int64
		_, err := fmt.Sscanf(entry.Name(), "%d_", &version)
		if err != nil {
			dbLog("Skipping down migration file with invalid version: %s", entry.Name())
			continue
		}

		migrationFiles = append(migrationFiles, struct {
			version int64
			name    string
		}{version, entry.Name()})
	}

	sort.Slice(migrationFiles, func(i, j int) bool {
		return migrationFiles[i].version > migrationFiles[j].version
	})

	for _, mf := range migrationFiles {
		if !applied[mf.version] {
			continue
		}

		path := "migrations/" + mf.name
		content, err := migrationsFS.ReadFile(path)
		if err != nil {
			return fmt.Errorf("Unable to undo the database update.")
		}

		dbLog("Rolling back migration %d: %s", mf.version, mf.name)
		if err := runDownMigration(mf.version, string(content)); err != nil {
			return fmt.Errorf("Unable to undo the database update.")
		}
		dbLog("Migration %d rolled back successfully", mf.version)
		return nil
	}

	return fmt.Errorf("No updates can be undone.")
}

func Migrate() error {
	if err := createMigrationsTable(); err != nil {
		return fmt.Errorf("Unable to access the database.")
	}

	applied, err := getAppliedVersions()
	if err != nil {
		return fmt.Errorf("Unable to access the database.")
	}

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("Unable to access the database.")
	}

	var migrationFiles []struct {
		version int64
		name    string
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") || strings.HasSuffix(entry.Name(), "_down.sql") {
			continue
		}

		var version int64
		_, err := fmt.Sscanf(entry.Name(), "%d_", &version)
		if err != nil {
			dbLog("Skipping migration file with invalid version: %s", entry.Name())
			continue
		}

		migrationFiles = append(migrationFiles, struct {
			version int64
			name    string
		}{version, entry.Name()})
	}

	sort.Slice(migrationFiles, func(i, j int) bool {
		return migrationFiles[i].version < migrationFiles[j].version
	})

	isTest := os.Getenv("APP_ENV") == "test"
	backupCreated := false
	var backupPath string

	for _, mf := range migrationFiles {
		if applied[mf.version] {
			continue
		}

		if !isTest && !backupCreated {
			path, err := CreatePreMigrationBackup(mf.version)
			if err != nil {
				dbLog("Warning: Failed to create pre-migration backup: %v", err)
			} else {
				backupPath = path
				backupCreated = true
				dbLog("Pre-migration backup created: %s", path)
			}
		}

		path := "migrations/" + mf.name
		content, err := migrationsFS.ReadFile(path)
		if err != nil {
			return fmt.Errorf("Unable to update the database.")
		}

		if !isTest {
			dbLog("Running migration %d: %s", mf.version, mf.name)
		}
		if err := runMigration(mf.version, string(content)); err != nil {
			if backupPath != "" {
				return fmt.Errorf("Database update failed. A backup was created at: %s\n\nTo fix this issue:\n1. Close the app\n2. Restore the backup using Settings > Restore\n3. Restart the app", backupPath)
			}
			return fmt.Errorf("Database update failed. The app may not work correctly until this is resolved. Please restart the app.")
		}
		if !isTest {
			dbLog("Migration %d completed", mf.version)
		}
	}

	return nil
}
