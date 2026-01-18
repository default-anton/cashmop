package cli

import (
	"cashmop/internal/database"
	"fmt"
)

type categoryListResponse struct {
	Ok    bool                `json:"ok"`
	Items []database.Category `json:"items"`
}

func (r categoryListResponse) TableHeaders() []string {
	return []string{"ID", "Name"}
}

func (r categoryListResponse) ToTable() [][]string {
	rows := make([][]string, len(r.Items))
	for i, item := range r.Items {
		rows[i] = []string{fmt.Sprint(item.ID), item.Name}
	}
	return rows
}

type categoryResponse struct {
	Ok   bool   `json:"ok"`
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

func handleCategories(args []string) commandResult {
	if len(args) == 0 {
		return commandResult{Err: validationError(ErrorDetail{Message: "Missing categories subcommand (list, rename, create)."})}
	}

	switch args[0] {
	case "list":
		return handleCategoriesList(args[1:])
	case "rename":
		return handleCategoriesRename(args[1:])
	case "create":
		return handleCategoriesCreate(args[1:])
	default:
		return commandResult{Err: validationError(ErrorDetail{Message: "Unknown categories subcommand."})}
	}
}

func handleCategoriesList(args []string) commandResult {
	fs := newSubcommandFlagSet("categories list")
	if ok, res := fs.parse(args, "categories"); !ok {
		return res
	}

	items, err := database.GetAllCategories()
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: categoryListResponse{Ok: true, Items: items}}
}

func handleCategoriesRename(args []string) commandResult {
	fs := newSubcommandFlagSet("categories rename")
	var id int64
	var name string
	fs.Int64Var(&id, "id", 0, "")
	fs.StringVar(&name, "name", "", "")
	if ok, res := fs.parse(args, "categories"); !ok {
		return res
	}

	if id == 0 || name == "" {
		return commandResult{Err: validationError(ErrorDetail{Message: "--id and --name are required."})}
	}

	if err := database.RenameCategory(id, name); err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: categoryResponse{Ok: true, ID: id, Name: name}}
}

func handleCategoriesCreate(args []string) commandResult {
	fs := newSubcommandFlagSet("categories create")
	var name string
	fs.StringVar(&name, "name", "", "")
	if ok, res := fs.parse(args, "categories"); !ok {
		return res
	}

	if name == "" {
		return commandResult{Err: validationError(ErrorDetail{Message: "--name is required."})}
	}

	id, err := database.GetOrCreateCategory(name)
	if err != nil {
		return commandResult{Err: runtimeError(ErrorDetail{Message: err.Error()})}
	}

	return commandResult{Response: categoryResponse{Ok: true, ID: id, Name: name}}
}
