package main

import (
	stdlibRuntime "runtime"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) ShowAbout() {
	wailsRuntime.EventsEmit(a.ctx, "show-about")
}

func (a *App) makeMenu() *menu.Menu {
	appMenu := menu.NewMenu()

	if stdlibRuntime.GOOS == "darwin" {
		applicationMenu := appMenu.AddSubmenu("CashMop")

		applicationMenu.AddText("About CashMop", nil, func(_ *menu.CallbackData) {
			a.ShowAbout()
		})

		applicationMenu.AddSeparator()
		applicationMenu.AddText("Services", nil, nil)
		applicationMenu.AddSeparator()
		applicationMenu.AddText("Hide CashMop", keys.CmdOrCtrl("h"), func(_ *menu.CallbackData) {
			wailsRuntime.WindowHide(a.ctx)
		})
		applicationMenu.AddText("Quit", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
			wailsRuntime.Quit(a.ctx)
		})
	}

	appMenu.Append(menu.EditMenu())
	appMenu.Append(menu.WindowMenu())

	if stdlibRuntime.GOOS != "darwin" {
		helpMenu := appMenu.AddSubmenu("Help")
		helpMenu.AddText("About CashMop", nil, func(_ *menu.CallbackData) {
			a.ShowAbout()
		})
	}

	return appMenu
}
