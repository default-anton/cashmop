export type CsvFieldKey = 'date' | 'description' | 'amount' | 'owner' | 'account' | 'currency' | 'debit' | 'credit' | 'amountColumn' | 'typeColumn';

export type AmountMapping =
  | { type: 'single'; column: string }
  | { type: 'debitCredit'; debitColumn?: string; creditColumn?: string }
  | { type: 'amountWithType'; amountColumn: string; typeColumn: string; negativeValue?: string; positiveValue?: string };

export type ImportMapping = {
  csv: {
    date: string;
    description: string[];
    amount: string; // legacy, keep for backward compatibility
    amountMapping?: AmountMapping;
    owner?: string;
    account?: string;
    currency?: string;
  };
  account: string;
  defaultOwner?: string;
  currencyDefault: string; // Used when csv.currency is not set
};

export type SavedMapping = {
  id: number;
  name: string;
  mapping: ImportMapping;
};
