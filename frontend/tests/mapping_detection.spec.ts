import { expect, test } from "@playwright/test";
import type { SavedMapping } from "../src/screens/ImportFlow/components/ColumnMapperTypes";
import {
  hasAmbiguousNormalizedHeaders,
  headersSignature,
  pickBestMapping,
} from "../src/screens/ImportFlow/mappingDetection";

test("headersSignature is order-insensitive and de-duplicates normalized headers", () => {
  const a = headersSignature([" Date ", "Amount", "Description", "Amount"]);
  const b = headersSignature(["description", "amount", "date"]);
  expect(a).toBe(b);
});

test("hasAmbiguousNormalizedHeaders detects duplicate headers after normalization", () => {
  expect(hasAmbiguousNormalizedHeaders(["Amount", " amount "])).toBe(true);
  expect(hasAmbiguousNormalizedHeaders(["Amount", "Balance"])).toBe(false);
});

test("pickBestMapping ignores subset-match for very small meta header sets", () => {
  const file = {
    headers: ["Date", "Description", "Amount", "Currency"],
    hasHeader: true,
    headerSource: "auto" as const,
  };

  const entries: SavedMapping[] = [
    {
      id: 1,
      name: "Too generic",
      mapping: {
        account: "Checking",
        currencyDefault: "CAD",
        csv: {
          date: "Date",
          description: ["Description"],
          amountMapping: { type: "single", column: "Amount" },
        },
        meta: { headers: ["Date", "Description", "Amount"], hasHeader: true },
      },
    },
  ];

  expect(pickBestMapping(file, entries)).toBeNull();
});
