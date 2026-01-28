package cashmop

import "strings"

func (s *Service) CategorizeTransaction(id int64, categoryName string) error {
	if strings.TrimSpace(categoryName) == "" {
		return s.store.UpdateTransactionCategory(id, 0)
	}
	catID, err := s.store.GetOrCreateCategory(categoryName)
	if err != nil {
		return err
	}
	return s.store.UpdateTransactionCategory(id, catID)
}
