package cli

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/default-anton/cashmop/internal/cashmop"
	"github.com/default-anton/cashmop/internal/database"
)

type mappingListResponse struct {
	Ok    bool                          `json:"ok"`
	Items []database.ColumnMappingModel `json:"items"`
}

type mappingItem struct {
	ID      int64           `json:"id"`
	Name    string          `json:"name"`
	Mapping json.RawMessage `json:"mapping"`
}

type mappingGetResponse struct {
	Ok   bool        `json:"ok"`
	Item mappingItem `json:"item"`
}

type mappingSaveResponse struct {
	Ok   bool   `json:"ok"`
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

func handleMappings(svc *cashmop.Service, args []string) commandResult {
	if len(args) == 0 {
		return commandResult{Err: validationError(ErrorDetail{
			Field:   "subcommand",
			Message: "Missing mappings subcommand (list, get, save, delete).",
			Hint:    "Use \"cashmop mappings list\", \"cashmop mappings get\", \"cashmop mappings save\", or \"cashmop mappings delete\".",
		})}
	}

	switch args[0] {
	case "list":
		return handleMappingsList(svc, args[1:])
	case "get":
		return handleMappingsGet(svc, args[1:])
	case "save":
		return handleMappingsSave(svc, args[1:])
	case "delete":
		return handleMappingsDelete(svc, args[1:])
	default:
		return commandResult{Err: validationError(ErrorDetail{
			Field:   "subcommand",
			Message: "Unknown mappings subcommand.",
			Hint:    "Use \"cashmop mappings list\", \"cashmop mappings get\", \"cashmop mappings save\", or \"cashmop mappings delete\".",
		})}
	}
}

func handleMappingsList(svc *cashmop.Service, args []string) commandResult {
	fs := newSubcommandFlagSet("mappings list")
	if ok, res := fs.parse(args, "mappings"); !ok {
		return res
	}

	items, err := svc.GetColumnMappings()
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: mappingListResponse{Ok: true, Items: items}}
}

func handleMappingsGet(svc *cashmop.Service, args []string) commandResult {
	fs := newSubcommandFlagSet("mappings get")
	var name string
	var id int64
	fs.StringVar(&name, "name", "", "")
	fs.Int64Var(&id, "id", 0, "")
	if ok, res := fs.parse(args, "mappings"); !ok {
		return res
	}

	var m *database.ColumnMappingModel
	var err error
	if id != 0 {
		m, err = svc.GetColumnMappingByID(id)
	} else if name != "" {
		m, err = svc.GetColumnMappingByName(name)
	} else {
		details := []ErrorDetail{
			{Field: "id", Message: "Either --id or --name is required.", Hint: "Provide --id <id> or --name <name>."},
			{Field: "name", Message: "Either --id or --name is required.", Hint: "Provide --id <id> or --name <name>."},
		}
		return commandResult{Err: validationError(details...)}
	}

	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}
	if m == nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: "Mapping not found."})}
	}

	return commandResult{Response: mappingGetResponse{
		Ok: true,
		Item: mappingItem{
			ID:      m.ID,
			Name:    m.Name,
			Mapping: json.RawMessage(m.MappingJSON),
		},
	}}
}

func handleMappingsSave(svc *cashmop.Service, args []string) commandResult {
	fs := newSubcommandFlagSet("mappings save")
	var name string
	var mappingPath string
	fs.StringVar(&name, "name", "", "")
	fs.StringVar(&mappingPath, "mapping", "", "")
	if ok, res := fs.parse(args, "mappings"); !ok {
		return res
	}

	if name == "" || mappingPath == "" {
		var details []ErrorDetail
		if name == "" {
			details = append(details, requiredFlagError("name", "Provide --name <name>."))
		}
		if mappingPath == "" {
			details = append(details, requiredFlagError("mapping", "Provide --mapping <path|->."))
		}
		return commandResult{Err: validationError(details...)}
	}

	var data []byte
	var err error
	if mappingPath == "-" {
		data, err = io.ReadAll(os.Stdin)
	} else {
		data, err = os.ReadFile(mappingPath)
	}
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: fmt.Sprintf("failed to read mapping: %v", err)})}
	}

	var js json.RawMessage
	if err := json.Unmarshal(data, &js); err != nil {
		return commandResult{Err: validationError(ErrorDetail{Field: "mapping", Message: "Invalid JSON mapping.", Hint: "Ensure the mapping is valid JSON."})}
	}

	id, err := svc.SaveColumnMapping(name, string(data))
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: mappingSaveResponse{Ok: true, ID: id, Name: name}}
}

func handleMappingsDelete(svc *cashmop.Service, args []string) commandResult {
	fs := newSubcommandFlagSet("mappings delete")
	var name string
	var id int64
	fs.StringVar(&name, "name", "", "")
	fs.Int64Var(&id, "id", 0, "")
	if ok, res := fs.parse(args, "mappings"); !ok {
		return res
	}

	if id == 0 && name == "" {
		details := []ErrorDetail{
			{Field: "id", Message: "Either --id or --name is required.", Hint: "Provide --id <id> or --name <name>."},
			{Field: "name", Message: "Either --id or --name is required.", Hint: "Provide --id <id> or --name <name>."},
		}
		return commandResult{Err: validationError(details...)}
	}

	if id == 0 {
		m, err := svc.GetColumnMappingByName(name)
		if err != nil {
			return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
		}
		if m == nil {
			return commandResult{Err: runtimeError(ErrorDetail{Message: "Mapping not found."})}
		}
		id = m.ID
	}

	if err := svc.DeleteColumnMapping(id); err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: map[string]bool{"ok": true, "deleted": true}}
}
