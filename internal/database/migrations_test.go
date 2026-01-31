package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/default-anton/cashmop/internal/mapping"
	_ "modernc.org/sqlite"
)

// openRawTestDB opens a raw SQLite database without any migrations applied.
// Returns the DB connection and the file path.
func openRawTestDB(t *testing.T) (*sql.DB, string) {
	t.Helper()

	path := filepath.Join(t.TempDir(), "test.db")
	db, err := sql.Open("sqlite", path+fmt.Sprintf("?_pragma=busy_timeout(%d)&_pragma=journal_mode(%s)", 5000, "WAL"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	return db, path
}

// migrationTestHelper provides utilities for testing a specific migration.
// When testing migration N, migrations 1..N-1 are applied, and migration N is NOT applied.
type migrationTestHelper struct {
	db      *sql.DB
	store   *Store
	t       *testing.T
	version int64
}

// run applies the migration being tested (version N)
func (h *migrationTestHelper) run() {
	h.t.Helper()

	content := h.loadMigrationContent(h.version, false)
	if err := h.store.runMigration(h.version, string(content)); err != nil {
		h.t.Fatalf("migration %d failed: %v", h.version, err)
	}
}

// runSQL executes the migration SQL without recording it in schema_migrations.
// Used for testing idempotency.
func (h *migrationTestHelper) runSQL() {
	h.t.Helper()

	content := h.loadMigrationContent(h.version, false)
	if _, err := h.db.Exec(string(content)); err != nil {
		h.t.Fatalf("migration SQL %d failed: %v", h.version, err)
	}
}

// runDown applies the down migration for the version being tested
func (h *migrationTestHelper) runDown() {
	h.t.Helper()

	content := h.loadMigrationContent(h.version, true)
	if err := h.store.runDownMigration(h.version, string(content)); err != nil {
		h.t.Fatalf("down migration %d failed: %v", h.version, err)
	}
}

// loadMigrationContent finds and reads a migration file by version
func (h *migrationTestHelper) loadMigrationContent(version int64, down bool) []byte {
	h.t.Helper()

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		h.t.Fatalf("failed to read migrations dir: %v", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		isDown := strings.HasSuffix(entry.Name(), "_down.sql")
		if down != isDown {
			continue
		}

		var v int64
		if _, err := fmt.Sscanf(entry.Name(), "%d_", &v); err != nil {
			continue
		}
		if v == version {
			content, err := migrationsFS.ReadFile("migrations/" + entry.Name())
			if err != nil {
				h.t.Fatalf("failed to read migration %d: %v", version, err)
			}
			return content
		}
	}

	h.t.Fatalf("migration %d not found", version)
	return nil
}

// exec executes raw SQL for test setup
func (h *migrationTestHelper) exec(sql string, args ...interface{}) {
	h.t.Helper()
	if _, err := h.db.Exec(sql, args...); err != nil {
		h.t.Fatalf("exec SQL failed: %v", err)
	}
}

// queryJSON extracts a JSON string from a query
func (h *migrationTestHelper) queryJSON(query string, args ...interface{}) string {
	h.t.Helper()
	var result string
	err := h.db.QueryRow(query, args...).Scan(&result)
	if err != nil {
		h.t.Fatalf("query failed: %v", err)
	}
	return result
}

// parseMapping parses mapping JSON into ImportMapping
func (h *migrationTestHelper) parseMapping(jsonStr string) mapping.ImportMapping {
	h.t.Helper()
	var m mapping.ImportMapping
	if err := json.Unmarshal([]byte(jsonStr), &m); err != nil {
		h.t.Fatalf("failed to unmarshal mapping: %v", err)
	}
	return m
}

// newMigrationTest creates a test helper for migration N with migrations 1..N-1 applied.
// The test database has the schema state just before migration N runs.
func newMigrationTest(t *testing.T, version int64) *migrationTestHelper {
	t.Helper()

	db, path := openRawTestDB(t)

	// Create a minimal Store for running migrations
	store := &Store{
		db:       db,
		dsnBase:  path,
		filePath: path,
		logger:   slog.New(slog.NewTextHandler(io.Discard, nil)),
	}

	// Create schema_migrations table (this is normally done by Migrate() before running migrations)
	if err := store.createMigrationsTable(); err != nil {
		t.Fatalf("failed to create schema_migrations table: %v", err)
	}

	// Get all migration files and run only those < version
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		t.Fatalf("failed to read migrations dir: %v", err)
	}

	var versions []int64
	for _, entry := range entries {
		if entry.IsDir() || strings.HasSuffix(entry.Name(), "_down.sql") {
			continue
		}
		var v int64
		if _, err := fmt.Sscanf(entry.Name(), "%d_", &v); err != nil {
			continue
		}
		if v < version {
			versions = append(versions, v)
		}
	}

	// Sort and apply migrations in order
	sort.Slice(versions, func(i, j int) bool { return versions[i] < versions[j] })
	for _, v := range versions {
		content := loadMigrationContent(t, v, false)
		if err := store.runMigration(v, string(content)); err != nil {
			t.Fatalf("failed to run migration %d: %v", v, err)
		}
	}

	return &migrationTestHelper{
		db:      db,
		store:   store,
		t:       t,
		version: version,
	}
}

// loadMigrationContent finds and reads a migration file by version (package-level helper)
func loadMigrationContent(t *testing.T, version int64, down bool) []byte {
	t.Helper()

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		t.Fatalf("failed to read migrations dir: %v", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		isDown := strings.HasSuffix(entry.Name(), "_down.sql")
		if down != isDown {
			continue
		}

		var v int64
		if _, err := fmt.Sscanf(entry.Name(), "%d_", &v); err != nil {
			continue
		}
		if v == version {
			content, err := migrationsFS.ReadFile("migrations/" + entry.Name())
			if err != nil {
				t.Fatalf("failed to read migration %d: %v", version, err)
			}
			return content
		}
	}

	t.Fatalf("migration %d not found", version)
	return nil
}
