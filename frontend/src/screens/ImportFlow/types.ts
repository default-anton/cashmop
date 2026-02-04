import type { ImportMapping } from "./components/ColumnMapperTypes";
import type { ParsedFileBase } from "./utils";

export type ParsedFile = ParsedFileBase & {
  mapping?: ImportMapping;
  autoMatchedMappingId?: number;
  autoMatchedMappingName?: string;
  userSelectedPresetId?: number | null;
  heuristicApplied?: boolean;
  selectedMonths?: string[];
  monthSelectionTouched?: boolean;
  mappingTouched?: boolean;
  rememberMappingChoice?: "off" | "save" | "update";
  rememberMappingTouched?: boolean;
  rememberMappingName?: string;
  rememberMappingError?: string | null;
};

export type ColumnRole =
  | "ignore"
  | "date"
  | "description"
  | "money"
  | "moneyOut"
  | "moneyIn"
  | "direction"
  | "account"
  | "currency";

export type MonthOption = {
  key: string;
  label: string;
  count: number;
};
