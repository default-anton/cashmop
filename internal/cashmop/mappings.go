package cashmop

import "github.com/default-anton/cashmop/internal/database"

func (s *Service) GetColumnMappings() ([]database.ColumnMappingModel, error) {
	return s.store.GetColumnMappings()
}

func (s *Service) SaveColumnMapping(name string, mappingJSON string) (int64, error) {
	return s.store.SaveColumnMapping(name, mappingJSON)
}

func (s *Service) DeleteColumnMapping(id int64) error {
	return s.store.DeleteColumnMapping(id)
}

func (s *Service) GetColumnMappingByID(id int64) (*database.ColumnMappingModel, error) {
	return s.store.GetColumnMappingByID(id)
}

func (s *Service) GetColumnMappingByName(name string) (*database.ColumnMappingModel, error) {
	return s.store.GetColumnMappingByName(name)
}
