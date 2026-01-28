package main

type TestDialogPaths struct {
	BackupSavePath  string `json:"backup_save_path"`
	ExportSavePath  string `json:"export_save_path"`
	RestoreOpenPath string `json:"restore_open_path"`
}

type TransactionInput struct {
	Date        string `json:"date"`
	Description string `json:"description"`
	Amount      int64  `json:"amount"`
	Category    string `json:"category"`
	Account     string `json:"account"`
	Owner       string `json:"owner"`
	Currency    string `json:"currency"`
}

type CategorizeResult struct {
	TransactionID int64   `json:"transaction_id"`
	AffectedIds   []int64 `json:"affected_ids"`
}

type RuleResult struct {
	RuleID      int64   `json:"rule_id"`
	AffectedIds []int64 `json:"affected_ids"`
}

type RuleUpdateResult struct {
	RuleID            int64 `json:"rule_id"`
	UncategorizeCount int   `json:"uncategorize_count"`
	AppliedCount      int   `json:"applied_count"`
}

type RuleDeleteResult struct {
	RuleID             int64 `json:"rule_id"`
	UncategorizedCount int   `json:"uncategorized_count"`
}

type ExcelData struct {
	Headers []string   `json:"headers"`
	Rows    [][]string `json:"rows"`
	AllRows [][]string `json:"allRows"`
}

type WebSearchResult struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
	Domain  string `json:"domain"`
}
