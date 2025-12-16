package database

import (
	"database/sql"
	"fmt"
)

// TransactionModel mirrors the database table structure
type TransactionModel struct {
	AccountID   int64
	OwnerID     *int64 // Nullable
	Date        string
	Description string
	Amount      float64
	Category    string
	Currency    string
	RawMetadata string
}

func GetOrCreateAccount(name string) (int64, error) {
	if name == "" {
		return 0, fmt.Errorf("account name cannot be empty")
	}

	var id int64
	err := DB.QueryRow("SELECT id FROM accounts WHERE name = ?", name).Scan(&id)
	if err == sql.ErrNoRows {
		// Create
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
		return nil, nil // Valid, owner can be null if not specified? Or we enforce it? Plan said FindOrCreateUser.
		// If empty name passed, maybe we just return nil because we can't create a user with empty name.
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
		INSERT INTO transactions 
		(account_id, owner_id, date, description, amount, category, currency, raw_metadata)
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
			t.Category,
			t.Currency,
			t.RawMetadata,
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}
