package models

type Transaction struct {
	ID          int    `json:"id"`
	Account     string `json:"account"`
	Currency    string `json:"currency"`
	Amount      int64  `json:"amount"`
	Description string `json:"description"`
	Owner       string `json:"owner"`
	Date        string `json:"date"`
	Category    string `json:"category"`
}
