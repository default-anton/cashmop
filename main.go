package main

import (
	"cashflow/internal/config"
	"context"
	"embed"
	"log"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	// Create application menu
	appMenu := menu.NewMenu()
	appMenu.Append(menu.AppMenu())
	appMenu.Append(menu.EditMenu())
	appMenu.Append(menu.WindowMenu())

	// Add Help menu with About item
	helpMenu := appMenu.AddSubmenu("Help")
	helpMenu.AddText("About Cashflow Tracker", keys.CmdOrCtrl("a"), func(_ *menu.CallbackData) {
		app.ShowAbout()
	})

	// On macOS, add About to the app menu as well
	// The app menu is automatically created by menu.AppMenu()

	err := wails.Run(&options.App{
		Title:  "Cashflow Tracker",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:       app.startup,
		OnDomReady: func(ctx context.Context) {
			state, err := config.LoadWindowState()
			if err != nil {
				log.Printf("Failed to load window state: %v", err)
				return
			}

			if err := config.ApplyWindowState(ctx, state); err != nil {
				log.Printf("Failed to apply window state: %v", err)
			}
		},
		OnBeforeClose: func(ctx context.Context) (prevent bool) {
			if err := config.SaveWindowState(ctx); err != nil {
				log.Printf("Failed to save window state: %v", err)
			}
			return false
		},
		Menu: appMenu,
		Bind: []interface{}{
			app,
		},
		StartHidden: os.Getenv("APP_ENV") == "test",
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
