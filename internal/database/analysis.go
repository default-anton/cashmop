package database

import (
	"fmt"
	"strings"
)

// MissingFilterID is the shared sentinel used by the frontend and backend to mean
// "missing / NULL" in filter selections (e.g. Uncategorized, No Owner).
const MissingFilterID int64 = 0

type AnalysisFilterOption struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type AnalysisFacets struct {
	Categories       []AnalysisFilterOption `json:"categories"`
	Owners           []AnalysisFilterOption `json:"owners"`
	HasUncategorized bool                   `json:"has_uncategorized"`
	HasNoOwner       bool                   `json:"has_no_owner"`
}

type AnalysisView struct {
	Transactions []TransactionModel `json:"transactions"`
	Facets       AnalysisFacets     `json:"facets"`
}

func (s *Store) GetAnalysisFacets(startDate string, endDate string) (AnalysisFacets, error) {
	// Categories present in the month.
	catRows, err := s.db.Query(`
		SELECT DISTINCT
			t.category_id,
			COALESCE(c.name, printf('Category #%d', t.category_id))
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE t.date >= ? AND t.date <= ? AND t.category_id IS NOT NULL
		ORDER BY LOWER(COALESCE(c.name, '')) ASC
	`, startDate, endDate)
	if err != nil {
		return AnalysisFacets{}, err
	}
	defer catRows.Close()

	var categories []AnalysisFilterOption
	for catRows.Next() {
		var id int64
		var name string
		if err := catRows.Scan(&id, &name); err != nil {
			return AnalysisFacets{}, err
		}
		name = strings.TrimSpace(name)
		if name == "" {
			name = fmt.Sprintf("Category #%d", id)
		}
		categories = append(categories, AnalysisFilterOption{ID: id, Name: name})
	}

	// Owners present in the month.
	ownerRows, err := s.db.Query(`
		SELECT DISTINCT
			t.owner_id,
			COALESCE(u.name, printf('Owner #%d', t.owner_id))
		FROM transactions t
		LEFT JOIN users u ON t.owner_id = u.id
		WHERE t.date >= ? AND t.date <= ? AND t.owner_id IS NOT NULL
		ORDER BY LOWER(COALESCE(u.name, '')) ASC
	`, startDate, endDate)
	if err != nil {
		return AnalysisFacets{}, err
	}
	defer ownerRows.Close()

	var owners []AnalysisFilterOption
	for ownerRows.Next() {
		var id int64
		var name string
		if err := ownerRows.Scan(&id, &name); err != nil {
			return AnalysisFacets{}, err
		}
		name = strings.TrimSpace(name)
		if name == "" {
			name = fmt.Sprintf("Owner #%d", id)
		}
		owners = append(owners, AnalysisFilterOption{ID: id, Name: name})
	}

	var hasUncategorized, hasNoOwner int
	row := s.db.QueryRow(`
		SELECT
			SUM(CASE WHEN category_id IS NULL THEN 1 ELSE 0 END) > 0 AS has_uncategorized,
			SUM(CASE WHEN owner_id IS NULL THEN 1 ELSE 0 END) > 0 AS has_no_owner
		FROM transactions
		WHERE date >= ? AND date <= ?
	`, startDate, endDate)
	if err := row.Scan(&hasUncategorized, &hasNoOwner); err != nil {
		return AnalysisFacets{}, err
	}

	return AnalysisFacets{
		Categories:       categories,
		Owners:           owners,
		HasUncategorized: hasUncategorized == 1,
		HasNoOwner:       hasNoOwner == 1,
	}, nil
}
