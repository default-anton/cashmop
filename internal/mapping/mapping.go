package mapping

type AmountMapping struct {
	Type          string `json:"type"`
	Column        string `json:"column,omitempty"`
	DebitColumn   string `json:"debitColumn,omitempty"`
	CreditColumn  string `json:"creditColumn,omitempty"`
	AmountColumn  string `json:"amountColumn,omitempty"`
	TypeColumn    string `json:"typeColumn,omitempty"`
	NegativeValue string `json:"negativeValue,omitempty"`
	PositiveValue string `json:"positiveValue,omitempty"`
	InvertSign    bool   `json:"invertSign,omitempty"`
}

type ImportMapping struct {
	CSV struct {
		Date          string        `json:"date"`
		Description   []string      `json:"description"`
		AmountMapping AmountMapping `json:"amountMapping"`
		Account       string        `json:"account,omitempty"`
		Currency      string        `json:"currency,omitempty"`
	} `json:"csv"`
	Account         string `json:"account"`
	Owner           string `json:"owner,omitempty"`
	CurrencyDefault string `json:"currencyDefault"`
}
