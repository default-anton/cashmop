package main

import wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"

const (
	EventTransactionsUpdated = "transactions-updated"
	EventCategoriesUpdated   = "categories-updated"
	EventOwnersUpdated       = "owners-updated"
)

func (a *App) emit(event string, data ...any) {
	// Wails runtime APIs require a specific context populated with frontend/event bindings.
	// Unit tests set ctx to context.Background(), so we need to no-op in that case.
	if a.ctx == nil || a.ctx.Value("events") == nil {
		return
	}
	wailsRuntime.EventsEmit(a.ctx, event, data...)
}
