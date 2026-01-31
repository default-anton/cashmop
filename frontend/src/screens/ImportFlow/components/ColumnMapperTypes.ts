export type CsvFieldKey =
  | "date"
  | "description"
  | "amount"
  | "owner"
  | "account"
  | "currency"
  | "debit"
  | "credit"
  | "amountColumn"
  | "typeColumn";

export type AmountMappingBase = {
  invertSign?: boolean;
};

export type AmountMapping =
  | (AmountMappingBase & { type: "single"; column: string })
  | (AmountMappingBase & { type: "debitCredit"; debitColumn?: string; creditColumn?: string })
  | (AmountMappingBase & {
      type: "amountWithType";
      amountColumn: string;
      typeColumn: string;
      negativeValue?: string;
      positiveValue?: string;
    });

export type ImportMapping = {
  csv: {
    date: string;
    description: string[];
    amountMapping: AmountMapping;
    account?: string;
    currency?: string;
  };
  account: string;
  owner?: string;
  currencyDefault: string; // Used when csv.currency is not set

  // Optional metadata used only for auto-detection in the UI.
  // Safe to persist because the backend stores mappings as opaque JSON.
  meta?: {
    headers?: string[]; // Normalized headers used to create the mapping
    hasHeader?: boolean;
  };
};

export type SavedMapping = {
  id: number;
  name: string;
  mapping: ImportMapping;
};
