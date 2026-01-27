package database

import (
	"database/sql"
	"fmt"
	"strings"
)

type TransactionModel struct {
	ID                   int64  `json:"id"`
	AccountID            int64  `json:"account_id"`
	AccountName          string `json:"account_name"`
	OwnerID              *int64 `json:"owner_id"`
	OwnerName            string `json:"owner_name"`
	Date                 string `json:"date"`
	Description          string `json:"description"`
	Amount               int64  `json:"amount"`
	CategoryID           *int64 `json:"category_id"`
	CategoryName         string `json:"category_name"`
	Currency             string `json:"currency"`
	RawMetadata          string `json:"raw_metadata"`
	AmountInMainCurrency *int64 `json:"amount_in_main_currency"`
	MainCurrency         string `json:"main_currency"`
}

func convertTransactionAmounts(txs []TransactionModel) ([]TransactionModel, error) {
	if len(txs) == 0 {
		return txs, nil
	}

	settings, err := GetCurrencySettings()
	if err != nil {
		return nil, err
	}
	baseCurrency := strings.TrimSpace(settings.MainCurrency)
	if baseCurrency == "" {
		baseCurrency = defaultMainCurrency
	}

	for i := range txs {
		var converted *int64
		if strings.ToUpper(strings.TrimSpace(txs[i].Currency)) == baseCurrency {
			// Same currency - no conversion needed
			converted = &txs[i].Amount
		} else {
			converted, err = ConvertAmount(txs[i].Amount, baseCurrency, txs[i].Currency, txs[i].Date)
			if err != nil {
				// Graceful degradation: log but continue with null
				logger.Error("fx conversion failed", "error", err, "tx_id", txs[i].ID, "currency", txs[i].Currency, "date", txs[i].Date)
				converted = nil
			}
		}
		txs[i].AmountInMainCurrency = converted
		txs[i].MainCurrency = baseCurrency
	}

	return txs, nil
}

func GetOrCreateAccount(name string) (int64, error) {
	if name == "" {
		return 0, fmt.Errorf("account name cannot be empty")
	}

	var id int64
	err := DB.QueryRow("SELECT id FROM accounts WHERE name = ?", name).Scan(&id)
	if err == sql.ErrNoRows {
		res, err := DB.Exec("INSERT INTO accounts (name) VALUES (?)", name)
		if err != nil {
			return 0, err
		}
		return res.LastInsertId()
	} else if err != nil {
		return 0, err
	}

	return id, nil
}

func GetOrCreateUser(name string) (*int64, error) {
	if name == "" {
		return nil, nil
	}

	var id int64
	err := DB.QueryRow("SELECT id FROM users WHERE name = ?", name).Scan(&id)
	if err == sql.ErrNoRows {
		res, err := DB.Exec("INSERT INTO users (name) VALUES (?)", name)
		if err != nil {
			return nil, err
		}
		lid, err := res.LastInsertId()
		if err != nil {
			return nil, err
		}
		return &lid, nil
	} else if err != nil {
		return nil, err
	}

	return &id, nil
}

func GetAccountMap() (map[string]int64, error) {
	rows, err := DB.Query("SELECT id, name FROM accounts")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := make(map[string]int64)
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		m[name] = id
	}
	return m, nil
}

func GetUserMap() (map[string]int64, error) {
	rows, err := DB.Query("SELECT id, name FROM users")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := make(map[string]int64)
	for rows.Next() {
		var id int64
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return nil, err
		}
		m[name] = id
	}
	return m, nil
}

func GetAccounts() ([]string, error) {
	rows, err := DB.Query("SELECT name FROM accounts ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var accounts []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		accounts = append(accounts, name)
	}
	return accounts, nil
}

type User struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

func GetAllUsers() ([]User, error) {
	rows, err := DB.Query("SELECT id, name FROM users ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Name); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

func GetUsers() ([]string, error) {
	rows, err := DB.Query("SELECT name FROM users ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		users = append(users, name)
	}
	return users, nil
}

func BatchInsertTransactions(txs []TransactionModel) error {
	if len(txs) == 0 {
		return nil
	}

	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT OR IGNORE INTO transactions
		(account_id, owner_id, date, description, amount, category_id, currency, raw_metadata)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, t := range txs {
		if _, err := stmt.Exec(
			t.AccountID,
			t.OwnerID,
			t.Date,
			t.Description,
			t.Amount,
			t.CategoryID,
			t.Currency,
			t.RawMetadata,
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func BatchInsertTransactionsWithCount(txs []TransactionModel) (int, int, error) {
	if len(txs) == 0 {
		return 0, 0, nil
	}

	tx, err := DB.Begin()
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT OR IGNORE INTO transactions
		(account_id, owner_id, date, description, amount, category_id, currency, raw_metadata)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return 0, 0, err
	}
	defer stmt.Close()

	inserted := 0
	for _, t := range txs {
		res, err := stmt.Exec(
			t.AccountID,
			t.OwnerID,
			t.Date,
			t.Description,
			t.Amount,
			t.CategoryID,
			t.Currency,
			t.RawMetadata,
		)
		if err != nil {
			return 0, 0, err
		}
		rows, err := res.RowsAffected()
		if err == nil && rows > 0 {
			inserted++
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, 0, err
	}

	return inserted, len(txs) - inserted, nil
}

func GetUncategorizedTransactions() ([]TransactionModel, error) {
	rows, err := DB.Query(`
		SELECT
			t.id, t.account_id, a.name, t.owner_id, COALESCE(u.name, ''),
			t.date, t.description, t.amount, t.category_id, t.currency
		FROM transactions t
		JOIN accounts a ON t.account_id = a.id
		LEFT JOIN users u ON t.owner_id = u.id
		WHERE t.category_id IS NULL
		ORDER BY t.date DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txs []TransactionModel
	for rows.Next() {
		var t TransactionModel
		if err := rows.Scan(
			&t.ID, &t.AccountID, &t.AccountName, &t.OwnerID, &t.OwnerName,
			&t.Date, &t.Description, &t.Amount, &t.CategoryID, &t.Currency,
		); err != nil {
			return nil, err
		}
		txs = append(txs, t)
	}
	return convertTransactionAmounts(txs)
}

func UpdateTransactionCategory(id int64, categoryID int64) error {
	var cid interface{} = categoryID
	if categoryID == 0 {
		cid = nil
	}
	_, err := DB.Exec("UPDATE transactions SET category_id = ? WHERE id = ?", cid, id)
	return err
}

func ClearTransactionCategories(ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	query := "UPDATE transactions SET category_id = NULL WHERE id IN (" + strings.Join(placeholders, ",") + ")"
	_, err := DB.Exec(query, args...)
	return err
}

func SearchTransactions(descriptionMatch string, matchType string, amountMin *int64, amountMax *int64) ([]TransactionModel, error) {
	query := `
		SELECT
			t.id, t.account_id, a.name, t.owner_id, COALESCE(u.name, ''),
			t.date, t.description, t.amount, t.category_id, COALESCE(c.name, ''), t.currency
		FROM transactions t
		JOIN accounts a ON t.account_id = a.id
		LEFT JOIN users u ON t.owner_id = u.id
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE t.category_id IS NULL
	`
	args := []any{}

	if descriptionMatch != "" {
		switch matchType {
		case "starts_with":
			query += " AND t.description LIKE ?"
			args = append(args, descriptionMatch+"%")
		case "ends_with":
			query += " AND t.description LIKE ?"
			args = append(args, "%"+descriptionMatch)
		case "exact":
			query += " AND t.description = ?"
			args = append(args, descriptionMatch)
		case "contains":
			query += " AND t.description LIKE ?"
			args = append(args, "%"+descriptionMatch+"%")
		}
	}

	query += " ORDER BY t.date DESC"

	var baseCurrency string
	needsAmountFilter := amountMin != nil || amountMax != nil
	if needsAmountFilter {
		settings, err := GetCurrencySettings()
		if err != nil {
			return nil, err
		}
		baseCurrency = strings.TrimSpace(settings.MainCurrency)
		if baseCurrency == "" {
			baseCurrency = defaultMainCurrency
		}
	}

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txs []TransactionModel
	for rows.Next() {
		var t TransactionModel
		if err := rows.Scan(
			&t.ID, &t.AccountID, &t.AccountName, &t.OwnerID, &t.OwnerName,
			&t.Date, &t.Description, &t.Amount, &t.CategoryID, &t.CategoryName, &t.Currency,
		); err != nil {
			return nil, err
		}
		if needsAmountFilter {
			converted, err := ConvertAmount(t.Amount, baseCurrency, t.Currency, t.Date)
			if err != nil {
				return nil, err
			}
			if converted == nil {
				continue
			}
			if amountMin != nil && *converted < *amountMin {
				continue
			}
			if amountMax != nil && *converted > *amountMax {
				continue
			}
		}
		txs = append(txs, t)
		if len(txs) >= 50 {
			break
		}
	}
	return convertTransactionAmounts(txs)
}

type RuleMatchPreview struct {
	Count        int                `json:"count"`
	MinAmount    *int64             `json:"min_amount"`
	MaxAmount    *int64             `json:"max_amount"`
	Transactions []TransactionModel `json:"transactions"`
}

func SearchTransactionsByRule(descriptionMatch string, matchType string, amountMin *int64, amountMax *int64, includeCategorized bool) ([]TransactionModel, error) {
	query := `
		SELECT
			t.id, t.account_id, a.name, t.owner_id, COALESCE(u.name, ''),
			t.date, t.description, t.amount, t.category_id, COALESCE(c.name, ''), t.currency
		FROM transactions t
		JOIN accounts a ON t.account_id = a.id
		LEFT JOIN users u ON t.owner_id = u.id
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE 1=1
	`
	args := []any{}

	if !includeCategorized {
		query += " AND t.category_id IS NULL"
	}

	if descriptionMatch != "" {
		switch matchType {
		case "starts_with":
			query += " AND t.description LIKE ?"
			args = append(args, descriptionMatch+"%")
		case "ends_with":
			query += " AND t.description LIKE ?"
			args = append(args, "%"+descriptionMatch)
		case "exact":
			query += " AND t.description = ?"
			args = append(args, descriptionMatch)
		case "contains":
			query += " AND t.description LIKE ?"
			args = append(args, "%"+descriptionMatch+"%")
		}
	}

	query += " ORDER BY t.date DESC"

	var baseCurrency string
	needsAmountFilter := amountMin != nil || amountMax != nil
	if needsAmountFilter {
		settings, err := GetCurrencySettings()
		if err != nil {
			return nil, err
		}
		baseCurrency = strings.TrimSpace(settings.MainCurrency)
		if baseCurrency == "" {
			baseCurrency = defaultMainCurrency
		}
	}

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var txs []TransactionModel
	for rows.Next() {
		var t TransactionModel
		if err := rows.Scan(
			&t.ID, &t.AccountID, &t.AccountName, &t.OwnerID, &t.OwnerName,
			&t.Date, &t.Description, &t.Amount, &t.CategoryID, &t.CategoryName, &t.Currency,
		); err != nil {
			return nil, err
		}
		if needsAmountFilter {
			converted, err := ConvertAmount(t.Amount, baseCurrency, t.Currency, t.Date)
			if err != nil {
				return nil, err
			}
			if converted == nil {
				continue
			}
			if amountMin != nil && *converted < *amountMin {
				continue
			}
			if amountMax != nil && *converted > *amountMax {
				continue
			}
		}
		txs = append(txs, t)
	}
	return convertTransactionAmounts(txs)
}

func PreviewRuleMatches(descriptionMatch string, matchType string, amountMin *int64, amountMax *int64, includeCategorized bool, limit int) (RuleMatchPreview, error) {
	if limit <= 0 {
		limit = 10
	}

	query := `
		SELECT
			t.id, t.account_id, a.name, t.owner_id, COALESCE(u.name, ''),
			t.date, t.description, t.amount, t.category_id, COALESCE(c.name, ''), t.currency
		FROM transactions t
		JOIN accounts a ON t.account_id = a.id
		LEFT JOIN users u ON t.owner_id = u.id
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE 1=1
	`
	args := []any{}

	if !includeCategorized {
		query += " AND t.category_id IS NULL"
	}

	if descriptionMatch != "" {
		switch matchType {
		case "starts_with":
			query += " AND t.description LIKE ?"
			args = append(args, descriptionMatch+"%")
		case "ends_with":
			query += " AND t.description LIKE ?"
			args = append(args, "%"+descriptionMatch)
		case "exact":
			query += " AND t.description = ?"
			args = append(args, descriptionMatch)
		case "contains":
			query += " AND t.description LIKE ?"
			args = append(args, "%"+descriptionMatch+"%")
		}
	}

	query += " ORDER BY t.date DESC"

	settings, err := GetCurrencySettings()
	if err != nil {
		return RuleMatchPreview{}, err
	}
	baseCurrency := strings.TrimSpace(settings.MainCurrency)
	if baseCurrency == "" {
		baseCurrency = defaultMainCurrency
	}

	rows, err := DB.Query(query, args...)
	if err != nil {
		return RuleMatchPreview{}, err
	}
	defer rows.Close()

	count := 0
	var minAmount *int64
	var maxAmount *int64
	preview := make([]TransactionModel, 0, limit)
	needsAmountFilter := amountMin != nil || amountMax != nil

	for rows.Next() {
		var t TransactionModel
		if err := rows.Scan(
			&t.ID, &t.AccountID, &t.AccountName, &t.OwnerID, &t.OwnerName,
			&t.Date, &t.Description, &t.Amount, &t.CategoryID, &t.CategoryName, &t.Currency,
		); err != nil {
			return RuleMatchPreview{}, err
		}

		converted, err := ConvertAmount(t.Amount, baseCurrency, t.Currency, t.Date)
		if err != nil {
			return RuleMatchPreview{}, err
		}

		if needsAmountFilter {
			if converted == nil {
				continue
			}
			if amountMin != nil && *converted < *amountMin {
				continue
			}
			if amountMax != nil && *converted > *amountMax {
				continue
			}
		}

		count++
		if converted != nil {
			if minAmount == nil || *converted < *minAmount {
				v := *converted
				minAmount = &v
			}
			if maxAmount == nil || *converted > *maxAmount {
				v := *converted
				maxAmount = &v
			}
		}

		if len(preview) < limit {
			preview = append(preview, t)
		}
	}

	convertedPreview, err := convertTransactionAmounts(preview)
	if err != nil {
		return RuleMatchPreview{}, err
	}

	return RuleMatchPreview{Count: count, MinAmount: minAmount, MaxAmount: maxAmount, Transactions: convertedPreview}, nil
}

type AmountRange struct {
	Min *int64 `json:"min"`
	Max *int64 `json:"max"`
}

func GetRuleAmountRange(descriptionMatch string, matchType string) (AmountRange, error) {
	query := `
		SELECT t.amount, t.currency, t.date
		FROM transactions t
		WHERE 1=1
	`
	args := []any{}

	if descriptionMatch != "" {
		switch matchType {
		case "starts_with":
			query += " AND t.description LIKE ?"
			args = append(args, descriptionMatch+"%")
		case "ends_with":
			query += " AND t.description LIKE ?"
			args = append(args, "%"+descriptionMatch)
		case "exact":
			query += " AND t.description = ?"
			args = append(args, descriptionMatch)
		default: // contains
			query += " AND t.description LIKE ?"
			args = append(args, "%"+descriptionMatch+"%")
		}
	}

	settings, err := GetCurrencySettings()
	if err != nil {
		return AmountRange{}, err
	}
	baseCurrency := strings.TrimSpace(settings.MainCurrency)
	if baseCurrency == "" {
		baseCurrency = defaultMainCurrency
	}

	rows, err := DB.Query(query, args...)
	if err != nil {
		return AmountRange{}, err
	}
	defer rows.Close()

	var minAmount *int64
	var maxAmount *int64

	for rows.Next() {
		var amount int64
		var currency string
		var date string
		if err := rows.Scan(&amount, &currency, &date); err != nil {
			return AmountRange{}, err
		}

		converted, err := ConvertAmount(amount, baseCurrency, currency, date)
		if err != nil {
			return AmountRange{}, err
		}

		if converted != nil {
			if minAmount == nil || *converted < *minAmount {
				minAmount = converted
			}
			if maxAmount == nil || *converted > *maxAmount {
				maxAmount = converted
			}
		}
	}

	return AmountRange{Min: minAmount, Max: maxAmount}, nil
}

func GetMonthList() ([]string, error) {
	rows, err := DB.Query(`
		SELECT DISTINCT strftime('%Y-%m', date) as month
		FROM transactions
		ORDER BY month DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var months []string
	for rows.Next() {
		var month string
		if err := rows.Scan(&month); err != nil {
			return nil, err
		}
		months = append(months, month)
	}
	return months, nil
}

func GetAnalysisTransactions(startDate string, endDate string, categoryIDs []int64, ownerIDs []int64) ([]TransactionModel, error) {
	query := `
		SELECT
			t.id, t.account_id, a.name, t.owner_id, COALESCE(u.name, ''),
			t.date, t.description, t.amount, t.category_id, COALESCE(c.name, ''), t.currency
		FROM transactions t
		JOIN accounts a ON t.account_id = a.id
		LEFT JOIN users u ON t.owner_id = u.id
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE t.date >= ? AND t.date <= ?
	`
	args := []any{startDate, endDate}

	if len(categoryIDs) > 0 {
		hasUncategorized := false
		var realIDs []int64
		for _, id := range categoryIDs {
			if id == 0 {
				hasUncategorized = true
			} else {
				realIDs = append(realIDs, id)
			}
		}

		if hasUncategorized {
			query += " AND (t.category_id IS NULL"
			if len(realIDs) > 0 {
				placeholders := make([]string, len(realIDs))
				for i, id := range realIDs {
					placeholders[i] = "?"
					args = append(args, id)
				}
				query += fmt.Sprintf(" OR t.category_id IN (%s)", strings.Join(placeholders, ","))
			}
			query += ")"
		} else if len(realIDs) > 0 {
			placeholders := make([]string, len(realIDs))
			for i, id := range realIDs {
				placeholders[i] = "?"
				args = append(args, id)
			}
			query += fmt.Sprintf(" AND t.category_id IN (%s)", strings.Join(placeholders, ","))
		}
	}

	if len(ownerIDs) > 0 {
		hasNoOwner := false
		var realOwnerIDs []int64
		for _, id := range ownerIDs {
			if id == 0 {
				hasNoOwner = true
			} else {
				realOwnerIDs = append(realOwnerIDs, id)
			}
		}

		if hasNoOwner {
			query += " AND (t.owner_id IS NULL"
			if len(realOwnerIDs) > 0 {
				placeholders := make([]string, len(realOwnerIDs))
				for i, id := range realOwnerIDs {
					placeholders[i] = "?"
					args = append(args, id)
				}
				query += fmt.Sprintf(" OR t.owner_id IN (%s)", strings.Join(placeholders, ","))
			}
			query += ")"
		} else if len(realOwnerIDs) > 0 {
			placeholders := make([]string, len(realOwnerIDs))
			for i, id := range realOwnerIDs {
				placeholders[i] = "?"
				args = append(args, id)
			}
			query += fmt.Sprintf(" AND t.owner_id IN (%s)", strings.Join(placeholders, ","))
		}
	}

	query += " ORDER BY t.date DESC"

	rows, err := DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	txs := []TransactionModel{}
	for rows.Next() {
		var t TransactionModel
		if err := rows.Scan(
			&t.ID, &t.AccountID, &t.AccountName, &t.OwnerID, &t.OwnerName,
			&t.Date, &t.Description, &t.Amount, &t.CategoryID, &t.CategoryName, &t.Currency,
		); err != nil {
			return nil, err
		}
		txs = append(txs, t)
	}
	return convertTransactionAmounts(txs)
}

func DeleteTransactions(ids []int64) (int, error) {
	if len(ids) == 0 {
		return 0, nil
	}

	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}

	query := "DELETE FROM transactions WHERE id IN (" + strings.Join(placeholders, ",") + ")"
	result, err := DB.Exec(query, args...)
	if err != nil {
		return 0, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}

	return int(rowsAffected), nil
}
