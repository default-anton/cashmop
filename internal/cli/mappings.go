package cli

import (
	"cashmop/internal/database"
	"encoding/json"
	"fmt"
	"io"
	"os"
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

func handleMappings(args []string) commandResult {
	if len(args) == 0 {
		return commandResult{Err: validationError(ErrorDetail{Message: "Missing mappings subcommand (list, get, save, delete)."})}
	}

	switch args[0] {
	case "list":
		return handleMappingsList(args[1:])
	case "get":
		return handleMappingsGet(args[1:])
	case "save":
		return handleMappingsSave(args[1:])
	case "delete":
		return handleMappingsDelete(args[1:])
	default:
		return commandResult{Err: validationError(ErrorDetail{Message: "Unknown mappings subcommand."})}
	}
}

func handleMappingsList(args []string) commandResult {
	fs := newSubcommandFlagSet("mappings list")
	if ok, res := fs.parse(args, "mappings"); !ok {
		return res
	}

	items, err := database.GetColumnMappings()
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: mappingListResponse{Ok: true, Items: items}}
}

func handleMappingsGet(args []string) commandResult {
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
		m, err = database.GetColumnMappingByID(id)
	} else if name != "" {
		m, err = database.GetColumnMappingByName(name)
	} else {
		return commandResult{Err: validationError(ErrorDetail{Message: "Either --id or --name is required."})}
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

func handleMappingsSave(args []string) commandResult {
	fs := newSubcommandFlagSet("mappings save")
	var name string
	var mappingPath string
	fs.StringVar(&name, "name", "", "")
	fs.StringVar(&mappingPath, "mapping", "", "")
	if ok, res := fs.parse(args, "mappings"); !ok {
		return res
	}

	if name == "" || mappingPath == "" {
		return commandResult{Err: validationError(ErrorDetail{Message: "--name and --mapping are required."})}
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
		return commandResult{Err: validationError(ErrorDetail{Field: "mapping", Message: "Invalid JSON mapping."})}
	}

	id, err := database.SaveColumnMapping(name, string(data))
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: mappingSaveResponse{Ok: true, ID: id, Name: name}}
}

func handleMappingsDelete(args []string) commandResult {
	fs := newSubcommandFlagSet("mappings delete")
	var name string
	var id int64
	fs.StringVar(&name, "name", "", "")
	fs.Int64Var(&id, "id", 0, "")
	if ok, res := fs.parse(args, "mappings"); !ok {
		return res
	}

	if id == 0 && name == "" {
		return commandResult{Err: validationError(ErrorDetail{Message: "Either --id or --name is required."})}
	}

	if id == 0 {
		m, err := database.GetColumnMappingByName(name)
		if err != nil {
			return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
		}
		if m == nil {
			return commandResult{Err: runtimeError(ErrorDetail{Message: "Mapping not found."})}
		}
		id = m.ID
	}

	if err := database.DeleteColumnMapping(id); err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: map[string]bool{"ok": true, "deleted": true}}
}
