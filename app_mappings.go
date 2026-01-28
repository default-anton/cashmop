package main

import (
	"encoding/json"
	"fmt"

	"github.com/default-anton/cashmop/internal/database"
)

func (a *App) GetColumnMappings() ([]database.ColumnMappingModel, error) {
	return a.svc.GetColumnMappings()
}

func (a *App) SaveColumnMapping(name string, mapping interface{}) (int64, error) {
	bytes, err := json.Marshal(mapping)
	if err != nil {
		return 0, fmt.Errorf("Unable to save column mapping. Please try again.")
	}
	return a.svc.SaveColumnMapping(name, string(bytes))
}

func (a *App) DeleteColumnMapping(id int64) error {
	return a.svc.DeleteColumnMapping(id)
}
