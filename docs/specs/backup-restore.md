# Backup & Restore Spec

## Overview

Data loss prevention is critical for a cash flow tracking application. Users store historical financial data, custom categories, accounts, and auto-categorization rules that represent significant time investment. This feature provides automatic and manual backup/restore capabilities to protect against data loss from corruption, accidental deletion, bugs, or device failure.

## Context

**Target Audience**: Tech-savvy users who expect speed, reliability, and control. They understand files and backups but want friction-free experience.

**Current State**:
- Users can export transactions (CSV/XLSX) from Analysis screen
- No full backup/restore for accounts, categories, rules
- Single SQLite database stores all application state

---

## Requirements

### Layer 1: Automatic Backups (Set & Forget)

**Trigger automatic backups before:**
- Database migrations (integrate with `internal/database/migrate.go`)

**Scheduled automatic backups:**
- Daily backup if 24+ hours have passed since last backup
- On app exit (if 24+ hours since last backup)

**Storage location**: Platform-specific backup subdirectory
- Windows: `%LOCALAPPDATA%\cashflow\backups\`
- macOS: `~/Library/Application Support/cashflow/backups/`
- Linux: `~/.config/cashflow/backups/`

**Retention policy**:
- Keep last 10 daily backups
- Keep last 5 weekly backups
- Automatic cleanup of old backups

**Backup format**: SQLite file created via `VACUUM INTO`
- Filename format: `cashflow_backup_YYYYMMDD_HHMMSS.db`
- Smaller than file copy (no free pages)
- Database integrity verified on creation

---

### Layer 2: Manual Backup & Restore

**Manual Backup**:
- Accessible via Settings screen or menu bar
- Native file picker dialog (via Wails `runtime.SaveFileDialog`)
- User chooses destination filename and location
- Shows "Last backup: [date]" indicator
- Toast notification on success

**Manual Restore**:
- Accessible via Settings screen or menu bar
- File picker dialog to select backup file
- **Pre-restore validation**:
  - Verify file is valid SQLite database
  - Show backup metadata: date, size, transaction count
  - Clear warning: "This will replace your current data. Are you sure?"
- **Safety net**: Creates backup of current database before restoring
- App restart required after restore
- Toast notification on success

**Restore behavior**: Complete database replacement
- Entire database file is replaced
- No merging or selective restore
- User is warned about destructive nature

---

## Technical Implementation

### Backend (Go)

**New package**: `internal/database/backup.go`

**Key functions**:

```go
// BackupDir returns the platform-specific backup directory
func BackupDir() (string, error)

// CreateBackup creates a backup using VACUUM INTO
// Returns backup file path and error
func CreateBackup(destination string) error

// CreateAutoBackup creates an automatic backup in the default backup directory
// Handles cleanup of old backups based on retention policy
// Returns backup file path and error
func CreateAutoBackup() (string, error)

// ValidateBackup checks if a file is a valid SQLite database
// Returns transaction count and error
func ValidateBackup(path string) (int64, error)

// RestoreBackup replaces the current database with a backup
// Creates a backup of current database first (safety net)
// Returns error
func RestoreBackup(backupPath string) error

// GetLastBackupTime returns the timestamp of the most recent auto-backup
// Returns zero time if no backups exist
func GetLastBackupTime() (time.Time, error)

// CleanupOldBackups removes old backups based on retention policy
// Keeps last 10 daily, last 5 weekly
func CleanupOldBackups() error

// ShouldAutoBackup determines if enough time has passed since last backup
// Returns true if 24+ hours since last backup
func ShouldAutoBackup() (bool, error)
```

**Database path utilities** (extend `internal/database/db.go`):

```go
// DatabasePath returns the current database file path
func DatabasePath() (string, error)

// EnsureBackupDir creates backup directory if it doesn't exist
func EnsureBackupDir() (string, error)
```

**Integration points**:

1. **Migration backup** (`internal/database/migrate.go`):
   - Before running migrations, call `CreateAutoBackup()`
   - Mark with special name: `cashflow_pre_migration_vNNN_YYYYMMDD_HHMMSS.db`

2. **App service layer** (`app.go`):
   - Add Wails-exported methods for frontend to call
   - Example method signatures:
     ```go
     func (a *App) CreateManualBackup() (string, error)
     func (a *App) RestoreBackup(backupPath string) error
     func (a *App) GetLastBackupInfo() (map[string]interface{}, error)
     func (a *App) ValidateBackupFile(path string) (map[string]interface{}, error)
     ```

3. **Startup/shutdown hooks** (`app.go`):
   - On startup: check if auto-backup is needed
   - On shutdown: trigger auto-backup if needed

---

### Frontend (React + TypeScript)

**New screen/component**: `frontend/src/screens/Settings/` (or enhance existing if it exists)

**UI Components**:

1. **Backup/Restore Section** in Settings:
   - Show last backup date/time
   - "Create Backup" button
   - "Restore from Backup" button
   - "Open Backup Folder" button (auto backups location)

2. **Manual Backup Flow**:
   - Click "Create Backup"
   - Native save dialog opens (Wails `runtime.SaveFileDialog`)
   - Suggested filename: `cashflow_backup_YYYYMMDD_HHMMSS.db`
   - User confirms location
   - Backup created, success toast shown

3. **Manual Restore Flow**:
   - Click "Restore from Backup"
   - Native open dialog (Wails `runtime.OpenFileDialog`)
   - Filter to `.db` files
   - User selects backup file
   - **Validation dialog** shows:
     - Backup file date (from filename/metadata)
     - File size
     - Transaction count
     - Warning message: "This will replace your current data. Are you sure?"
   - User confirms
   - Current database backed up automatically
   - Restore executed
   - App restart (graceful shutdown or prompt user to restart)

4. **Toast Notifications**:
   - Backup success: "Backup created successfully"
   - Backup failure: "Failed to create backup: {error}"
   - Restore success: "Database restored. Please restart the application."
   - Restore failure: "Failed to restore backup: {error}"

---

## File Structure & Conventions

**Backend**:
```
internal/database/
├── backup.go          # NEW: backup/restore functions
├── db.go              # EXISTING: add DatabasePath(), EnsureBackupDir()
├── migrate.go         # EXISTING: add pre-migration backup
├── migrations/        # EXISTING
└── schema.sql         # EXISTING
```

**Frontend**:
```
frontend/src/
├── screens/
│   ├── Settings/      # NEW or enhance existing
│   │   ├── BackupRestore.tsx   # NEW: backup/restore UI
│   │   └── index.tsx
│   ├── Analysis/      # EXISTING
│   ├── ImportFlow/    # EXISTING
│   └── CategorizationLoop/  # EXISTING
└── ...
```

**Wails bindings** (in `app.go`):
- All backup/restore functions must be exported (capitalized, public)
- Use proper error handling and return meaningful error messages

---

## Edge Cases & Error Handling

### Disk Space Issues
- **Detection**: Check available disk space before backup
- **Error**: "Insufficient disk space to create backup"
- **Action**: Fail gracefully, notify user, don't attempt backup
- **Known Issue**: The `hasSufficientSpace()` function uses Unix-specific `syscall.Statfs_t`. Windows compatibility is not yet verified. For Windows users, the space check may not work correctly and will fail gracefully (assumes enough space if unknown). This needs cross-platform testing and potential fix before Windows release.

### Database Locks
- **Detection**: SQLite locked errors during `VACUUM INTO`
- **Error**: "Database is busy. Close other operations and try again."
- **Action**: Retry with exponential backoff, timeout after 30 seconds

### Corrupted Backup File
- **Detection**: `ValidateBackup()` fails or returns error
- **Error**: "Selected file is not a valid backup database"
- **Action**: Don't proceed with restore, notify user

### Invalid Backup Schema
- **Detection**: Backup has different schema version
- **Error**: "Backup is from an incompatible version"
- **Action**: Don't proceed, recommend export/import as workaround

### Migration Failures
- **Detection**: Migration returns error
- **Error**: "Migration failed. Database backed up to: {path}"
- **Action**: Keep pre-migration backup, abort startup

### Permissions Issues
- **Detection**: Cannot write to backup directory
- **Error**: "Permission denied. Check write access to backup directory"
- **Action**: Fail gracefully, notify user

### Concurrent Backup Requests
- **Detection**: Multiple backup calls overlapping
- **Action**: Use mutex/sync lock to ensure only one backup operation at a time

---

## Testing Requirements

### Unit Tests (Go)

**File**: `internal/database/backup_test.go`

Test cases:
1. `TestCreateBackup`: Creates backup, verifies file exists and is valid SQLite
2. `TestValidateBackup`: Tests valid database, invalid file, corrupted file
3. `TestRestoreBackup`: Creates backup, modifies database, restores, verifies data
4. `TestCleanupOldBackups`: Creates multiple backups, runs cleanup, verifies correct files remain
5. `TestShouldAutoBackup`: Tests time logic for auto-backup triggers
6. `TestDatabasePath`: Verifies correct path per platform (mocked)

### Integration Tests (Playwright)

**File**: `frontend/src/screens/Settings/BackupRestore.spec.ts` or similar

Test scenarios:
1. Manual backup flow: button → dialog → success toast → verify file created
2. Manual restore flow: button → select file → validation → confirm → restore → restart
3. Auto-backup timing: trigger conditions, verify backup created
4. Error handling: invalid file, disk full (mocked), permissions

### Manual Testing Checklist

- [ ] Backup created in correct location
- [ ] Backup file is valid SQLite database
- [ ] Backup can be restored successfully
- [ ] Pre-restore validation shows correct info
- [ ] Warning message displayed before restore
- [ ] Current database backed up before restore
- [ ] App restart works after restore
- [ ] Auto-backup triggers work (daily, pre-migration, etc.)
- [ ] Old backups cleaned up correctly
- [ ] Toast notifications show correctly
- [ ] Last backup date updates in UI
- [ ] "Open Backup Folder" opens correct directory
- [ ] Errors handled gracefully with user-friendly messages

---

## Performance Considerations

- `VACUUM INTO` copies entire database, so backup time scales with database size
- For large databases (>1000 transactions), consider progress indicator
- Auto-backups on app exit should be fast; consider timeout (e.g., 5 seconds max)
- Don't block UI during backup; run in goroutine if needed

---

## Security & Privacy

- Backups contain sensitive financial data
- Respect user's chosen backup location (don't force cloud paths)
- Default auto-backup directory is local-only
- No telemetry on backup/restore operations
- User has full control over backup files

---

## Future Enhancements (Out of Scope for v1.0)

- Cloud sync (multi-device synchronization)
- Scheduled backups to user-specified locations
- Incremental backups (for very large databases)
- Export to JSON format (human-readable, editable)
- Password-protected/encrypted backups
- Selective restore (specific tables or date ranges)

---

## References

- SQLite VACUUM INTO: https://www.sqlite.org/lang_vacuum.html
- Wails runtime dialogs: https://wails.io/docs/reference/runtime/dialog/
- Export functionality: `docs/specs/export.md` (for reference on similar UI patterns)
