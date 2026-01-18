package cli_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
)

var (
	binaryPath string
	binaryDir  string
	buildOnce  sync.Once
	buildErr   error
	buildCount atomic.Int32
)

func ensureBinary() error {
	buildOnce.Do(func() {
		buildCount.Add(1)
		tmpDir, err := os.MkdirTemp("", "cashmop-cli-test-build-*")
		if err != nil {
			buildErr = fmt.Errorf("failed to create temp dir: %w", err)
			return
		}
		binaryDir = tmpDir
		binaryPath = filepath.Join(tmpDir, "cashmop")
		cmd := exec.Command("go", "build", "-o", binaryPath, "../../")
		if output, err := cmd.CombinedOutput(); err != nil {
			buildErr = fmt.Errorf("failed to build binary: %w\n%s", err, output)
			return
		}
	})

	return buildErr
}

func TestMain(m *testing.M) {
	exitCode := m.Run()
	if binaryDir != "" {
		if err := os.RemoveAll(binaryDir); err != nil {
			fmt.Fprintf(os.Stderr, "failed to remove temp dir: %v\n", err)
		}
	}
	os.Exit(exitCode)
}

type result struct {
	Stdout   string
	Stderr   string
	ExitCode int
	JSON     map[string]interface{}
}

func run(dbPath string, args ...string) (result, error) {
	return runWithStdin(dbPath, "", args...)
}

func runWithStdin(dbPath string, stdin string, args ...string) (result, error) {
	if err := ensureBinary(); err != nil {
		return result{}, err
	}

	var fullArgs []string
	if dbPath != "" {
		fullArgs = append(fullArgs, "--db", dbPath)
	}
	fullArgs = append(fullArgs, args...)

	cmd := exec.Command(binaryPath, fullArgs...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if stdin != "" {
		cmd.Stdin = bytes.NewBufferString(stdin)
	}

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			exitCode = exitError.ExitCode()
		} else {
			return result{}, err
		}
	}

	res := result{
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		ExitCode: exitCode,
	}

	isHelp := false
	for _, arg := range args {
		if arg == "-h" || arg == "--help" || arg == "help" || arg == "--version" {
			isHelp = true
			break
		}
	}

	if !isHelp && stdout.Len() > 0 {
		var j map[string]interface{}
		if err := json.Unmarshal(stdout.Bytes(), &j); err == nil {
			res.JSON = j
		}
	}

	return res, nil
}

func setupDB(t *testing.T) string {
	tmpDir := t.TempDir()
	return filepath.Join(tmpDir, "cashmop.db")
}

func assertGlobal(t *testing.T, res result, expectedExitCode int) {
	t.Helper()
	if res.ExitCode != expectedExitCode {
		t.Errorf("expected exit code %d, got %d. Stderr: %q, Stdout: %q", expectedExitCode, res.ExitCode, res.Stderr, res.Stdout)
	}
	if expectedExitCode == 0 && res.Stderr != "" {
		t.Errorf("expected empty stderr for success, got %q", res.Stderr)
	}
	if res.JSON == nil {
		t.Errorf("expected JSON output, got %q", res.Stdout)
	} else {
		if _, ok := res.JSON["ok"]; !ok {
			t.Errorf("expected 'ok' field in JSON, got %+v", res.JSON)
		}
	}
}

func TestBinaryBuildOnce(t *testing.T) {
	if err := ensureBinary(); err != nil {
		t.Fatal(err)
	}
	if err := ensureBinary(); err != nil {
		t.Fatal(err)
	}
	if buildCount.Load() != 1 {
		t.Fatalf("expected binary build once, got %d", buildCount.Load())
	}
}

func TestHelpVersion(t *testing.T) {
	t.Run("help", func(t *testing.T) {
		res, err := run("", "--help")
		if err != nil {
			t.Fatal(err)
		}
		if res.ExitCode != 0 {
			t.Errorf("expected exit code 0, got %d", res.ExitCode)
		}
		if res.Stderr != "" {
			t.Errorf("expected empty stderr, got %q", res.Stderr)
		}
		if !bytes.Contains([]byte(res.Stdout), []byte("Usage:")) {
			t.Errorf("expected help text in stdout, got %q", res.Stdout)
		}
	})

	t.Run("version", func(t *testing.T) {
		res, err := run("", "--version")
		if err != nil {
			t.Fatal(err)
		}
		if res.ExitCode != 0 {
			t.Errorf("expected exit code 0, got %d", res.ExitCode)
		}
		if res.Stderr != "" {
			t.Errorf("expected empty stderr, got %q", res.Stderr)
		}
		if res.Stdout == "" {
			t.Errorf("expected version in stdout, got empty")
		}
	})
}

func TestDBIsolation(t *testing.T) {
	db1 := setupDB(t)
	db2 := setupDB(t)

	res, err := run(db1, "categories", "create", "--name", "Category1")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db1, "categories", "list")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)
	items := res.JSON["items"].([]interface{})
	if len(items) != 1 {
		t.Errorf("expected 1 item in db1, got %d", len(items))
	}

	res, err = run(db2, "categories", "list")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)
	items = res.JSON["items"].([]interface{})
	if len(items) != 0 {
		t.Errorf("expected 0 items in db2, got %d", len(items))
	}
}

func TestMappings(t *testing.T) {
	db := setupDB(t)
	mappingJSON := `{"csv":{"date":"Date","description":["Desc"],"amountMapping":{"type":"single","column":"Amount"}},"account":"BMO","currencyDefault":"CAD"}`

	res, err := runWithStdin(db, mappingJSON, "mappings", "save", "--name", "MyMapping", "--mapping", "-")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)
	mappingID := res.JSON["id"].(float64)

	res, err = run(db, "mappings", "list")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "mappings", "get", "--id", fmt.Sprintf("%d", int64(mappingID)))
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "mappings", "get", "--name", "MyMapping")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "mappings", "delete", "--name", "MyMapping")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "mappings", "list")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)
}

func TestSettings(t *testing.T) {
	db := setupDB(t)

	res, err := run(db, "settings", "get")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "settings", "set", "--main-currency", "USD")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "settings", "get")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)
	settings := res.JSON["settings"].(map[string]interface{})
	if settings["main_currency"] != "USD" {
		t.Errorf("expected USD, got %v", settings["main_currency"])
	}
}

func TestTransactionsAndImport(t *testing.T) {
	db := setupDB(t)

	res, err := run(db, "import", "--file", "sample.csv", "--mapping", "mapping.json", "--month", "2025-01")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-01-31")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)
	txs := res.JSON["transactions"].([]interface{})
	if len(txs) != 3 {
		t.Errorf("expected 3 transactions, got %d", len(txs))
	}
	tx := txs[0].(map[string]interface{})
	txID := tx["id"].(float64)

	res, err = run(db, "tx", "categorize", "--id", fmt.Sprintf("%d", int64(txID)), "--category", "Food")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "tx", "categorize", "--id", fmt.Sprintf("%d", int64(txID)), "--uncategorize")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)
}

func TestRules(t *testing.T) {
	db := setupDB(t)
	_, _ = run(db, "import", "--file", "sample.csv", "--mapping", "mapping.json", "--month", "2025-01")

	res, err := run(db, "rules", "create", "--match-value", "Groceries", "--match-type", "exact", "--category", "Food")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)
	ruleID := res.JSON["rule_id"].(float64)

	res, err = run(db, "rules", "list")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "rules", "preview", "--match-value", "Internet", "--match-type", "contains")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "rules", "update", "--id", fmt.Sprintf("%d", int64(ruleID)), "--category", "Groceries", "--recategorize")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "rules", "delete", "--id", fmt.Sprintf("%d", int64(ruleID)), "--uncategorize")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)
}

func TestExport(t *testing.T) {
	db := setupDB(t)
	_, _ = run(db, "import", "--file", "sample.csv", "--mapping", "mapping.json", "--month", "2025-01")

	tmpDir := t.TempDir()
	csvPath := filepath.Join(tmpDir, "export.csv")

	res, err := run(db, "export", "--start", "2025-01-01", "--end", "2025-01-31", "--format", "csv", "--out", csvPath)
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)
}

func TestBackup(t *testing.T) {
	db := setupDB(t)
	_, _ = run(db, "import", "--file", "sample.csv", "--mapping", "mapping.json", "--month", "2025-01")

	tmpDir := t.TempDir()
	backupPath := filepath.Join(tmpDir, "backup.db")

	res, err := run(db, "backup", "create", "--out", backupPath)
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "backup", "info")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "backup", "validate", "--file", backupPath)
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "backup", "restore", "--file", backupPath)
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)
}

func TestFx(t *testing.T) {
	db := setupDB(t)

	res, err := run(db, "fx", "status")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "fx", "rate", "--base", "CAD", "--quote", "CAD", "--date", "2025-01-01")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)
}

func TestImportDetailed(t *testing.T) {
	db := setupDB(t)

	res, err := run(db, "import")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 2)

	res, err = run(db, "import", "--file", "sample.csv", "--mapping", "mapping.json", "--month", "2025-01", "--dry-run")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)

	res, err = run(db, "import", "--file", "sample.csv", "--mapping", "mapping.json", "--month", "2025-01", "--no-apply-rules")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 0)
}

func TestTxListDetailed(t *testing.T) {
	db := setupDB(t)
	_, _ = run(db, "import", "--file", "sample.csv", "--mapping", "mapping.json", "--month", "2025-01")

	res, err := run(db, "tx", "list", "--start", "2025-01-01", "--end", "2025-05-01")
	if err != nil {
		t.Fatal(err)
	}
	assertGlobal(t, res, 2)
}

func TestInstallCli(t *testing.T) {
	tmpDir := t.TempDir()
	
	res, err := run("", "install-cli", "--path", tmpDir)
	if err != nil {
		t.Fatal(err)
	}
	
	if res.JSON["ok"] == true {
		assertGlobal(t, res, 0)
		
		res, err = run("", "uninstall-cli", "--path", tmpDir)
		if err != nil {
			t.Fatal(err)
		}
		assertGlobal(t, res, 0)
	}
}
