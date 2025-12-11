package models

// Transaction maps to your UI and DB schema
type Transaction struct {
 ID          int     `json:"id"`
 Account     string  `json:"account"`
 Currency    string  `json:"currency"`
 Amount      float64 `json:"amount"`
 Description string  `json:"description"`
 Owner       string  `json:"owner"`
 Date        string  `json:"date"` // YYYY-MM-DD
 Category    string  `json:"category"`
}