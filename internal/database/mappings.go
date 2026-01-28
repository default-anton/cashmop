package database

import "database/sql"

type ColumnMappingModel struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	MappingJSON string `json:"mapping_json"`
}

func (s *Store) GetColumnMappings() ([]ColumnMappingModel, error) {
	rows, err := s.db.Query("SELECT id, name, mapping_json FROM column_mappings ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	mappings := []ColumnMappingModel{}
	for rows.Next() {
		var m ColumnMappingModel
		if err := rows.Scan(&m.ID, &m.Name, &m.MappingJSON); err != nil {
			return nil, err
		}
		mappings = append(mappings, m)
	}
	return mappings, nil
}

func (s *Store) SaveColumnMapping(name string, mappingJSON string) (int64, error) {
	res, err := s.db.Exec(`
		INSERT INTO column_mappings (name, mapping_json)
		VALUES (?, ?)
		ON CONFLICT(name) DO UPDATE SET mapping_json=excluded.mapping_json`,
		name, mappingJSON,
	)
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		// If it was an update, LastInsertId might be 0.
		var existingID int64
		err2 := s.db.QueryRow("SELECT id FROM column_mappings WHERE name = ?", name).Scan(&existingID)
		if err2 == nil {
			return existingID, nil
		}
		return 0, err
	}
	return id, nil
}

func (s *Store) GetColumnMappingByID(id int64) (*ColumnMappingModel, error) {
	var m ColumnMappingModel
	err := s.db.QueryRow("SELECT id, name, mapping_json FROM column_mappings WHERE id = ?", id).Scan(&m.ID, &m.Name, &m.MappingJSON)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *Store) GetColumnMappingByName(name string) (*ColumnMappingModel, error) {
	var m ColumnMappingModel
	err := s.db.QueryRow("SELECT id, name, mapping_json FROM column_mappings WHERE name = ?", name).Scan(&m.ID, &m.Name, &m.MappingJSON)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *Store) DeleteColumnMapping(id int64) error {
	_, err := s.db.Exec("DELETE FROM column_mappings WHERE id = ?", id)
	return err
}
