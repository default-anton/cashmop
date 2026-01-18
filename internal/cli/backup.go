package cli

import (
	"cashmop/internal/database"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"
)

type backupCreateResponse struct {
	Ok   bool   `json:"ok"`
	Path string `json:"path"`
}

type backupInfoResponse struct {
	Ok               bool   `json:"ok"`
	LastBackupTime   string `json:"last_backup_time"`
	HasBackup        bool   `json:"has_backup"`
}

type backupValidateResponse struct {
	Ok               bool      `json:"ok"`
	Path             string    `json:"path"`
	Size             int64     `json:"size"`
	TransactionCount int64     `json:"transaction_count"`
	CreatedAt        time.Time `json:"created_at"`
}

type backupRestoreResponse struct {
	Ok               bool   `json:"ok"`
	RestoredFrom     string `json:"restored_from"`
	SafetyBackupPath string `json:"safety_backup_path"`
}

func handleBackup(args []string) commandResult {
	if len(args) == 0 {
		return commandResult{Err: validationError(ErrorDetail{Message: "Missing backup subcommand (create, info, validate, restore)."}) }
	}

	switch args[0] {
	case "create":
		return handleBackupCreate(args[1:])
	case "info":
		return handleBackupInfo(args[1:])
	case "validate":
		return handleBackupValidate(args[1:])
	case "restore":
		return handleBackupRestore(args[1:])
	default:
		return commandResult{Err: validationError(ErrorDetail{Message: "Unknown backup subcommand."}) }
	}
}

func handleBackupCreate(args []string) commandResult {
	fs := flag.NewFlagSet("backup create", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var help bool
	var out string
	fs.BoolVar(&help, "help", false, "")
	fs.BoolVar(&help, "h", false, "")
	fs.StringVar(&out, "out", "", "")
	if err := fs.Parse(args); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Message: err.Error()})}
	}
	if help {
		printHelp("backup")
		return commandResult{Help: true}
	}

	if out == "" {
		backupDir, err := database.EnsureBackupDir()
		if err != nil {
			return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
		}
		timestamp := time.Now().Format("20060102_150405")
		out = filepath.Join(backupDir, fmt.Sprintf("cashmop_backup_%s.db", timestamp))
	}

	// CreateBackup uses VACUUM INTO which fails if file exists.
	// CLI spec says "Exports overwrite existing output files."
	if _, err := os.Stat(out); err == nil {
		if err := os.Remove(out); err != nil {
			return commandResult{Err: runtimeError(ErrorDetail{Message: fmt.Sprintf("failed to remove existing file: %v", err)})}
		}
	}

	if err := database.CreateBackup(out); err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: backupCreateResponse{Ok: true, Path: out}}
}

func handleBackupInfo(args []string) commandResult {
	fs := flag.NewFlagSet("backup info", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var help bool
	fs.BoolVar(&help, "help", false, "")
	fs.BoolVar(&help, "h", false, "")
	if err := fs.Parse(args); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Message: err.Error()})}
	}
	if help {
		printHelp("backup")
		return commandResult{Help: true}
	}

	lastTime, err := database.GetLastBackupTime()
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	last := ""
	if !lastTime.IsZero() {
		last = lastTime.Format(time.RFC3339)
	}

	return commandResult{Response: backupInfoResponse{
		Ok:             true,
		LastBackupTime: last,
		HasBackup:      !lastTime.IsZero(),
	}}
}

func handleBackupValidate(args []string) commandResult {
	fs := flag.NewFlagSet("backup validate", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var help bool
	var file string
	fs.BoolVar(&help, "help", false, "")
	fs.BoolVar(&help, "h", false, "")
	fs.StringVar(&file, "file", "", "")
	if err := fs.Parse(args); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Message: err.Error()})}
	}
	if help {
		printHelp("backup")
		return commandResult{Help: true}
	}

	if file == "" {
		return commandResult{Err: validationError(ErrorDetail{Field: "file", Message: "--file is required."})}
	}

	count, err := database.ValidateBackup(file)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	info, err := os.Stat(file)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: backupValidateResponse{
		Ok:               true,
		Path:             file,
		Size:             info.Size(),
		TransactionCount: count,
		CreatedAt:        info.ModTime(),
	}}
}

func handleBackupRestore(args []string) commandResult {
	fs := flag.NewFlagSet("backup restore", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var help bool
	var file string
	fs.BoolVar(&help, "help", false, "")
	fs.BoolVar(&help, "h", false, "")
	fs.StringVar(&file, "file", "", "")
	if err := fs.Parse(args); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Message: err.Error()})}
	}
	if help {
		printHelp("backup")
		return commandResult{Help: true}
	}

	if file == "" {
		return commandResult{Err: validationError(ErrorDetail{Field: "file", Message: "--file is required."})}
	}

	safetyPath, err := database.RestoreBackupWithSafety(file)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: backupRestoreResponse{
		Ok:               true,
		RestoredFrom:     file,
		SafetyBackupPath: safetyPath,
	}}
}
