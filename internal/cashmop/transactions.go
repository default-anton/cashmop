package cashmop

import (
	"strings"

	"github.com/default-anton/cashmop/internal/database"
)

func (s *Service) GetUncategorizedTransactions() ([]database.TransactionModel, error) {
	return s.store.GetUncategorizedTransactions()
}

func (s *Service) SearchTransactions(descriptionMatch string, matchType string, amountMin *int64, amountMax *int64) ([]database.TransactionModel, error) {
	return s.store.SearchTransactions(descriptionMatch, matchType, amountMin, amountMax)
}

func (s *Service) GetMonthList() ([]string, error) {
	return s.store.GetMonthList()
}

func (s *Service) GetAnalysisTransactions(startDate string, endDate string, categoryIDs []int64, ownerIDs []int64) ([]database.TransactionModel, error) {
	return s.store.GetAnalysisTransactions(startDate, endDate, categoryIDs, ownerIDs)
}

func (s *Service) GetAnalysisFacets(startDate string, endDate string) (database.AnalysisFacets, error) {
	return s.store.GetAnalysisFacets(startDate, endDate)
}

func (s *Service) DeleteTransactions(ids []int64) (int, error) {
	return s.store.DeleteTransactions(ids)
}

func (s *Service) RenameCategory(id int64, newName string) error {
	return s.store.RenameCategory(id, newName)
}

func (s *Service) GetAccounts() ([]string, error) {
	return s.store.GetAccounts()
}

func (s *Service) GetOwners() ([]string, error) {
	return s.store.GetUsers()
}

func (s *Service) GetAllUsers() ([]database.User, error) {
	return s.store.GetAllUsers()
}

func (s *Service) CreateAccount(name string) (int64, error) {
	return s.store.GetOrCreateAccount(strings.TrimSpace(name))
}

func (s *Service) CreateOwner(name string) (*int64, error) {
	return s.store.GetOrCreateUser(strings.TrimSpace(name))
}

func (s *Service) GetAccountMap() (map[string]int64, error) {
	return s.store.GetAccountMap()
}

func (s *Service) GetUserMap() (map[string]int64, error) {
	return s.store.GetUserMap()
}

func (s *Service) BatchInsertTransactionsWithCount(txs []database.TransactionModel) (int, int, error) {
	return s.store.BatchInsertTransactionsWithCount(txs)
}
