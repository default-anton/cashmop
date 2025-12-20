package database

import (
	"database/sql"
	"fmt"
)

// TransactionModel mirrors the database table structure
type TransactionModel struct {
	ID           int64   `json:"id"`
	AccountID    int64   `json:"account_id"`
	AccountName  string  `json:"account_name"`
	OwnerID      *int64  `json:"owner_id"` // Nullable
	OwnerName    string  `json:"owner_name"`
	Date         string  `json:"date"`
	Description  string  `json:"description"`
	Amount       float64 `json:"amount"`
	CategoryID   *int64  `json:"category_id"` // Nullable
	CategoryName string  `json:"category_name"`
	Currency     string  `json:"currency"`
	RawMetadata  string  `json:"raw_metadata"`
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
	return txs, nil
}

func UpdateTransactionCategory(id int64, categoryID int64) error {
	_, err := DB.Exec("UPDATE transactions SET category_id = ? WHERE id = ?", categoryID, id)
	return err
}
