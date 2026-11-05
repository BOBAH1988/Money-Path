# Data Model — Денежный путь

## Entities

### IncomeRecord
- id: string (uuid)
- year: number (2017..2026)
- month: number (1..12)
- category: string
- amount: number (>=0)
- source: string (sheet/block name)
- importBatchId?: string

### ExpenseRecord
- id, year, month, category, amount, importBatchId?

### Liability
- id, name, amount, monthlyPercent, importBatchId?

### Category
- id, name, type: 'income'|'expense'

### ImportBatch
- id, createdAt (ISO), fileName, years[], recordsCount, totalAmount, errors[]

## Normalization rule
One non-empty cell "category × month" = one record. Empty/zero cells skipped.

## Uniqueness
Unique key: (year, month, type, category, amount? no) → (year, month, type, category). Re-import upserts by key.

## Edge cases
- empty cell → skip
- 0 → skip (configurable keepZeros)
- text in amount → error, skip
- negative/invalid → error
