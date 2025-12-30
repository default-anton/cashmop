package database

import (
	"embed"
	"fmt"
	"log"
	"os"
	"sort"
	"strings"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

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
		return fmt.Errorf("migration %d failed: %w", version, err)
	}

	if _, err := tx.Exec("INSERT INTO schema_migrations (version) VALUES (?)", version); err != nil {
		return fmt.Errorf("failed to record migration %d: %w", version, err)
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
		return fmt.Errorf("down migration %d failed: %w", version, err)
	}

	if _, err := tx.Exec("DELETE FROM schema_migrations WHERE version = ?", version); err != nil {
		return fmt.Errorf("failed to unrecord migration %d: %w", version, err)
	}

	return tx.Commit()
}

// Rollback rolls back the most recent migration
func Rollback() error {
	if err := createMigrationsTable(); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	applied, err := getAppliedVersions()
	if err != nil {
		return fmt.Errorf("failed to get applied versions: %w", err)
	}

	if len(applied) == 0 {
		return fmt.Errorf("no migrations to rollback")
	}

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("failed to read migrations dir: %w", err)
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
			log.Printf("Skipping down migration file with invalid version: %s", entry.Name())
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
			return fmt.Errorf("failed to read down migration %s: %w", path, err)
		}

		log.Printf("Rolling back migration %d: %s", mf.version, mf.name)
		if err := runDownMigration(mf.version, string(content)); err != nil {
			return fmt.Errorf("rollback failed for migration %d: %w", mf.version, err)
		}
		log.Printf("Migration %d rolled back successfully", mf.version)
		return nil
	}

	return fmt.Errorf("no down migration found for latest version")
}

func Migrate() error {
	if err := createMigrationsTable(); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	applied, err := getAppliedVersions()
	if err != nil {
		return fmt.Errorf("failed to get applied versions: %w", err)
	}

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("failed to read migrations dir: %w", err)
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
			log.Printf("Skipping migration file with invalid version: %s", entry.Name())
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
				log.Printf("Warning: Failed to create pre-migration backup: %v", err)
			} else {
				backupPath = path
				backupCreated = true
				log.Printf("Pre-migration backup created: %s", path)
			}
		}

		path := "migrations/" + mf.name
		content, err := migrationsFS.ReadFile(path)
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", path, err)
		}

		if !isTest {
			log.Printf("Running migration %d: %s", mf.version, mf.name)
		}
		if err := runMigration(mf.version, string(content)); err != nil {
			if backupPath != "" {
				return fmt.Errorf("migration %d failed: %w\n\nTo recover from this error:\n1. A backup was created at: %s\n2. Restore the backup manually or use the app's restore feature\n3. Check the migration file for syntax errors\n4. Ensure you have sufficient disk space\n5. Contact support if the issue persists", mf.version, err, backupPath)
			}
			return fmt.Errorf("migration %d failed: %w\n\nNo backup was available. The database may be in an inconsistent state.", mf.version, err)
		}
		if !isTest {
			log.Printf("Migration %d completed", mf.version)
		}
	}

	return nil
}
