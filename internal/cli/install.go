package cli

import (
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
)

type installResponse struct {
	Ok   bool   `json:"ok"`
	Path string `json:"path"`
}

type uninstallResponse struct {
	Ok      bool `json:"ok"`
	Deleted bool `json:"deleted"`
}

func handleInstallCli(args []string) commandResult {
	fs := flag.NewFlagSet("install-cli", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var help bool
	var target string
	fs.BoolVar(&help, "help", false, "")
	fs.BoolVar(&help, "h", false, "")
	fs.StringVar(&target, "path", "", "")
	if err := fs.Parse(args); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Message: err.Error()})}
	}
	if help {
		printHelp("install-cli")
		return commandResult{Help: true}
	}

	if runtime.GOOS == "windows" {
		return commandResult{Err: runtimeError(ErrorDetail{Message: "install-cli is not supported on Windows. Use the installer to add CashMop to PATH."})}
	}

	path, err := installCliBinary(target)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: installResponse{Ok: true, Path: path}}
}

func handleUninstallCli(args []string) commandResult {
	fs := flag.NewFlagSet("uninstall-cli", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	var help bool
	var target string
	fs.BoolVar(&help, "help", false, "")
	fs.BoolVar(&help, "h", false, "")
	fs.StringVar(&target, "path", "", "")
	if err := fs.Parse(args); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Message: err.Error()})}
	}
	if help {
		printHelp("uninstall-cli")
		return commandResult{Help: true}
	}

	if runtime.GOOS == "windows" {
		return commandResult{Err: runtimeError(ErrorDetail{Message: "uninstall-cli is not supported on Windows."})}
	}

	deleted, err := uninstallCliBinary(target)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: uninstallResponse{Ok: true, Deleted: deleted}}
}

func resolveInstallDir(target string) (string, error) {
	if target != "" {
		return target, nil
	}

	// Try /usr/local/bin
	const localBin = "/usr/local/bin"
	info, err := os.Stat(localBin)
	if err == nil && info.IsDir() {
		// Check if writable
		f, err := os.Create(filepath.Join(localBin, ".cashmop_test"))
		if err == nil {
			f.Close()
			os.Remove(f.Name())
			return localBin, nil
		}
	}

	// Fallback to ~/.local/bin
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("unable to determine home directory")
	}
	return filepath.Join(home, ".local", "bin"), nil
}

func installCliBinary(target string) (string, error) {
	targetDir, err := resolveInstallDir(target)
	if err != nil {
		return "", err
	}

	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return "", fmt.Errorf("unable to create target directory: %s", targetDir)
	}

	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("unable to locate executable")
	}

	dest := filepath.Join(targetDir, "cashmop")
	if _, err := os.Lstat(dest); err == nil {
		if err := os.Remove(dest); err != nil {
			return "", fmt.Errorf("unable to remove existing file at %s", dest)
		}
	}

	if err := os.Symlink(exe, dest); err != nil {
		return "", fmt.Errorf("unable to create symlink: %w", err)
	}

	return dest, nil
}

func uninstallCliBinary(target string) (bool, error) {
	targetDir, err := resolveInstallDir(target)
	if err != nil {
		return false, err
	}

	dest := filepath.Join(targetDir, "cashmop")
	if _, err := os.Lstat(dest); err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}

	if err := os.Remove(dest); err != nil {
		return false, fmt.Errorf("unable to remove %s", dest)
	}

	return true, nil
}
