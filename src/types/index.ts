export type RecordType = 'income' | 'expense';

export interface IncomeRecord {
  id: string;
  year: number;
  month: number;
  category: string;
  amount: number;
  source: string;
  importBatchId?: string;
}

export interface ExpenseRecord {
  id: string;
  year: number;
  month: number;
  category: string;
  amount: number;
  importBatchId?: string;
}

export interface Liability {
  id: string;
  name: string;
  amount: number;
  monthlyPercent: number;
  importBatchId?: string;
}

export interface Category {
  id: string;
  name: string;
  type: RecordType;
}

export interface ImportBatch {
  id: string;
  createdAt: string;
  fileName: string;
  years: number[];
  recordsCount: number;
  totalAmount: number;
  errors: string[];
}

export interface ParsedCell {
  category: string;
  month: number;
  amount: number;
}

export interface ParsePreview {
  years: number[];
  recordsCount: number;
  totalByYear: Record<number, number>;
  errors: string[];
}

export type BudgetGroup = 'monthly' | 'planned';

export type BudgetRowType = 'item' | 'subtotal' | 'total';

export interface BudgetPlanItem {
  id: string;
  name: string;
  amount: number;
  group: BudgetGroup;
  type: BudgetRowType;
  linkedGroup?: BudgetGroup; // для subtotal: ссылка на группу, чей итог отображается
}

export interface BudgetPlan {
  items: BudgetPlanItem[];
  updatedAt: string;
}
