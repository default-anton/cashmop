package paths

import (
	"os"
	"path/filepath"
	"runtime"
)

const appName = "cashflow"

// AppConfigDir returns the application config directory, creating it if needed
func AppConfigDir() (string, error) {
	var dir string

	switch runtime.GOOS {
	case "windows":
		if localAppData := os.Getenv("LOCALAPPDATA"); localAppData != "" {
			dir = filepath.Join(localAppData, appName)
			break
		}
		userConfigDir, err := os.UserConfigDir()
		if err != nil {
			return "", err
		}
		dir = filepath.Join(userConfigDir, appName)
	default:
		userConfigDir, err := os.UserConfigDir()
		if err != nil {
			return "", err
		}
		dir = filepath.Join(userConfigDir, appName)
	}

	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}

	return dir, nil
}
