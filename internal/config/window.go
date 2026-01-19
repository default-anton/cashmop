package config

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/default-anton/cashmop/internal/paths"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	defaultWidth  = 1024
	defaultHeight = 768
	configFile    = "window-state.json"
)

type WindowState struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

func LoadWindowState() (WindowState, error) {
	path, err := configPath()
	if err != nil {
		return defaultState(), fmt.Errorf("get config path: %w", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return defaultState(), nil
		}
		return defaultState(), fmt.Errorf("read config: %w", err)
	}

	var state WindowState
	if err := json.Unmarshal(data, &state); err != nil {
		return defaultState(), fmt.Errorf("unmarshal config: %w", err)
	}

	return state, nil
}

func SaveWindowState(ctx context.Context) error {
	width, height := runtime.WindowGetSize(ctx)
	x, y := runtime.WindowGetPosition(ctx)

	state := WindowState{
		X:      x,
		Y:      y,
		Width:  width,
		Height: height,
	}

	path, err := configPath()
	if err != nil {
		return fmt.Errorf("get config path: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal state: %w", err)
	}

	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write config: %w", err)
	}

	return nil
}

func IsWindowStateValid(state WindowState) bool {
	const (
		minWindowSize = 100
		maxWindowSize = 16384
		maxPosition   = 32768
	)

	if state.Width < minWindowSize || state.Width > maxWindowSize {
		return false
	}
	if state.Height < minWindowSize || state.Height > maxWindowSize {
		return false
	}
	if state.X < -maxPosition || state.X > maxPosition {
		return false
	}
	if state.Y < -maxPosition || state.Y > maxPosition {
		return false
	}

	return true
}

func ApplyWindowState(ctx context.Context, state WindowState) error {
	if !IsWindowStateValid(state) {
		runtime.WindowCenter(ctx)
		runtime.WindowSetSize(ctx, defaultWidth, defaultHeight)
		return nil
	}

	runtime.WindowSetPosition(ctx, state.X, state.Y)
	runtime.WindowSetSize(ctx, state.Width, state.Height)
	return nil
}

func defaultState() WindowState {
	return WindowState{
		Width:  defaultWidth,
		Height: defaultHeight,
	}
}

func configPath() (string, error) {
	configDir, err := paths.AppConfigDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(configDir, configFile), nil
}
