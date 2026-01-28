package cashmop

import (
	"sync"

	"github.com/default-anton/cashmop/internal/database"
)

type Service struct {
	store *database.Store

	webSearchCache sync.Map
}

func New(store *database.Store) *Service {
	return &Service{store: store}
}

func (s *Service) Store() *database.Store {
	return s.store
}
