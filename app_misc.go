package main

import (
	"fmt"

	"github.com/default-anton/cashmop/internal/version"
)

func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

func (a *App) GetVersion() string {
	return version.Version
}
