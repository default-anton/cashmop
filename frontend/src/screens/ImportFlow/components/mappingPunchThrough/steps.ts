import {
  Calendar,
  CreditCard,
  DollarSign,
  FileText,
  Globe,
  User,
} from 'lucide-react';

import type { Step } from './types';

export const STEPS: Step[] = [
  {
    key: 'date',
    label: 'Date',
    instruction: 'Click the column that contains the transaction date.',
    icon: Calendar,
  },
  {
    key: 'amount',
    label: 'Amount',
    instruction: 'Click the amount column (or map Debit/Credit).',
    icon: DollarSign,
  },
  {
    key: 'description',
    label: 'Description',
    instruction: 'Click one or more columns to build the transaction description.',
    icon: FileText,
  },
  {
    key: 'account',
    label: 'Account',
    instruction: 'Pick a static account (fast) or map an Account column (flexible).',
    icon: CreditCard,
  },
  {
    key: 'owner',
    label: 'Owner',
    instruction: 'Optional: pick a default owner or map an Owner column.',
    icon: User,
    optional: true,
  },
  {
    key: 'currency',
    label: 'Currency',
    instruction: 'Optional: keep a default currency or map a Currency column.',
    icon: Globe,
    optional: true,
  },
];
