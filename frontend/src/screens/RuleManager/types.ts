export type MatchType = "contains" | "starts_with" | "ends_with" | "exact";

export type RuleRow = {
  id: number;
  match_type: MatchType;
  match_value: string;
  category_id: number;
  category_name: string;
  amount_min?: number | null;
  amount_max?: number | null;
  created_at?: string;
};

export type RulePayload = {
  id: number;
  match_type: MatchType;
  match_value: string;
  category_id: number;
  category_name: string;
  amount_min: number | null;
  amount_max: number | null;
};
