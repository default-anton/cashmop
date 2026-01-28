package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/default-anton/cashmop/internal/cashmop"
	"github.com/default-anton/cashmop/internal/database"
)

type App struct {
	ctx context.Context

	store *database.Store
	svc   *cashmop.Service

	bgCtx    context.Context
	bgCancel context.CancelFunc
	bgWg     sync.WaitGroup

	testDialogMu    sync.RWMutex
	testDialogPaths TestDialogPaths
	testDirMu       sync.Mutex
	testDir         string
}

func NewApp() *App {
	return &App{}
}

func isTestEnv() bool {
	return strings.EqualFold(os.Getenv("APP_ENV"), "test")
}

func (a *App) IsTestEnv() bool {
	return isTestEnv()
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.bgCtx, a.bgCancel = context.WithCancel(ctx)

	store, err := database.Open("", slog.Default())
	if err != nil {
		log.Printf("Failed to open database: %v", err)
		os.Exit(1)
	}
	a.store = store
	a.svc = cashmop.New(store)

	if isTestEnv() {
		return
	}

	a.bgWg.Add(1)
	go func() {
		defer a.bgWg.Done()
		if _, err := a.TriggerAutoBackup(); err != nil {
			log.Printf("Auto-backup failed: %v", err)
		}
	}()

	a.bgWg.Add(1)
	go func() {
		defer a.bgWg.Done()
		a.syncFxRates(a.bgCtx)
	}()
}

func (a *App) shutdown(ctx context.Context) {
	if a.bgCancel != nil {
		a.bgCancel()
	}

	bgDone := make(chan struct{})
	go func() {
		a.bgWg.Wait()
		close(bgDone)
	}()
	select {
	case <-bgDone:
	case <-time.After(10 * time.Second):
		log.Printf("Background tasks did not stop within 10 seconds")
	}

	// Trigger auto-backup on exit if needed (with timeout to prevent hanging)
	done := make(chan struct{})
	go func() {
		_, _ = a.TriggerAutoBackup()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(15 * time.Second):
		log.Printf("Auto-backup on exit timed out after 15 seconds")
	}

	if a.store != nil {
		_ = a.store.Close()
	}
}

func (a *App) SetTestDialogPaths(paths TestDialogPaths) {
	a.testDialogMu.Lock()
	a.testDialogPaths = paths
	a.testDialogMu.Unlock()
}

func (a *App) getTestDialogPaths() TestDialogPaths {
	a.testDialogMu.RLock()
	defer a.testDialogMu.RUnlock()
	return a.testDialogPaths
}

func (a *App) ensureTestDir() (string, error) {
	a.testDirMu.Lock()
	defer a.testDirMu.Unlock()

	if a.testDir != "" {
		return a.testDir, nil
	}

	base := filepath.Join(os.TempDir(), "cashmop-test")
	runID := strings.TrimSpace(os.Getenv("CASHMOP_TEST_RUN_ID"))
	if runID != "" {
		base = filepath.Join(base, runID)
	}

	if err := os.MkdirAll(base, 0o755); err != nil {
		return "", fmt.Errorf("create test dir: %w", err)
	}

	a.testDir = base
	return base, nil
}

func ensureUniquePath(path string) string {
	if _, err := os.Stat(path); err != nil {
		return path
	}

	ext := filepath.Ext(path)
	base := strings.TrimSuffix(path, ext)
	timestamp := time.Now().Format("20060102_150405_000000000")
	return fmt.Sprintf("%s_%s%s", base, timestamp, ext)
}

func (a *App) testSavePath(kind, ext string) (string, error) {
	paths := a.getTestDialogPaths()
	switch kind {
	case "backup":
		if paths.BackupSavePath != "" {
			return ensureUniquePath(paths.BackupSavePath), nil
		}
	case "export":
		if paths.ExportSavePath != "" {
			return ensureUniquePath(paths.ExportSavePath), nil
		}
	}

	dir, err := a.ensureTestDir()
	if err != nil {
		return "", err
	}

	timestamp := time.Now().Format("20060102_150405_000000000")
	filename := fmt.Sprintf("cashmop_%s_%s.%s", kind, timestamp, ext)
	return filepath.Join(dir, filename), nil
}

func (a *App) testRestorePath() (string, error) {
	paths := a.getTestDialogPaths()
	if paths.RestoreOpenPath != "" {
		return paths.RestoreOpenPath, nil
	}

	dir, err := a.ensureTestDir()
	if err != nil {
		return "", err
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", err
	}

	var latestPath string
	var latestTime time.Time
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".db" {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if latestPath == "" || info.ModTime().After(latestTime) {
			latestPath = filepath.Join(dir, entry.Name())
			latestTime = info.ModTime()
		}
	}

	return latestPath, nil
}
