package main

import (
	"fmt"

	"github.com/default-anton/cashmop/internal/database"
	"github.com/default-anton/cashmop/internal/fuzzy"
)

func (a *App) GetUncategorizedTransactions() ([]database.TransactionModel, error) {
	return a.svc.GetUncategorizedTransactions()
}

func (a *App) CategorizeTransaction(id int64, categoryName string) (*CategorizeResult, error) {
	if err := a.svc.CategorizeTransaction(id, categoryName); err != nil {
		return nil, err
	}
	return &CategorizeResult{TransactionID: id, AffectedIds: []int64{id}}, nil
}

func (a *App) DeleteTransactions(ids []int64) (int, error) {
	return a.svc.DeleteTransactions(ids)
}

func (a *App) RenameCategory(id int64, newName string) error {
	return a.svc.RenameCategory(id, newName)
}

func (a *App) FuzzySearch(query string, items []string) []string {
	return fuzzy.Match(query, items)
}

func (a *App) SearchCategories(query string) ([]database.Category, error) {
	return a.svc.SearchCategories(query)
}

func (a *App) GetCategories() ([]database.Category, error) {
	return a.svc.GetCategories()
}

func (a *App) GetAccounts() ([]string, error) {
	return a.svc.GetAccounts()
}

func (a *App) GetOwners() ([]string, error) {
	return a.svc.GetOwners()
}

func (a *App) GetAllUsers() ([]database.User, error) {
	return a.svc.GetAllUsers()
}

func (a *App) CreateAccount(name string) (int64, error) {
	return a.svc.CreateAccount(name)
}

func (a *App) CreateOwner(name string) (int64, error) {
	res, err := a.svc.CreateOwner(name)
	if err != nil {
		return 0, err
	}
	if res == nil {
		return 0, fmt.Errorf("failed to create owner")
	}
	return *res, nil
}

func (a *App) SearchTransactions(descriptionMatch string, matchType string, amountMin *int64, amountMax *int64) ([]database.TransactionModel, error) {
	return a.svc.SearchTransactions(descriptionMatch, matchType, amountMin, amountMax)
}

func (a *App) GetMonthList() ([]string, error) {
	return a.svc.GetMonthList()
}

func (a *App) GetAnalysisTransactions(startDate string, endDate string, categoryIDs []int64, ownerIDs []int64) ([]database.TransactionModel, error) {
	return a.svc.GetAnalysisTransactions(startDate, endDate, categoryIDs, ownerIDs)
}

func (a *App) GetAnalysisView(startDate string, endDate string, categoryIDs []int64, ownerIDs []int64) (database.AnalysisView, error) {
	transactions, err := a.svc.GetAnalysisTransactions(startDate, endDate, categoryIDs, ownerIDs)
	if err != nil {
		return database.AnalysisView{}, err
	}
	facets, err := a.svc.GetAnalysisFacets(startDate, endDate)
	if err != nil {
		return database.AnalysisView{}, err
	}
	return database.AnalysisView{Transactions: transactions, Facets: facets}, nil
}
