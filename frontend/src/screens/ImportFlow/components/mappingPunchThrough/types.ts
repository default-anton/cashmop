import React from 'react';

import { type ImportMapping } from '../ColumnMapperTypes';

export interface MappingPunchThroughProps {
  csvHeaders: string[];
  rows: string[][];
  fileCount: number;
  fileIndex: number;
  hasHeader: boolean;
  detectedHasHeader: boolean;
  headerSource: 'auto' | 'manual';
  onHeaderChange: (hasHeader: boolean) => void;
  onComplete: (mapping: ImportMapping) => void;
  initialMapping?: ImportMapping | null;

  detectedMappingName?: string;
  suggestedSaveName?: string;
  onSaveMapping?: (
    name: string,
    mapping: ImportMapping,
    source: { headers: string[]; hasHeader: boolean }
  ) => Promise<void>;
}

export type StepKey = 'date' | 'amount' | 'description' | 'account' | 'owner' | 'currency';

export type Step = {
  key: StepKey;
  label: string;
  instruction: string;
  icon: React.ElementType;
  optional?: boolean;
};
