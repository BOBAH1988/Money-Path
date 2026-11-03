# Import Spec

## Algorithm
1. Read workbook sheets.
2. Detect blocks by scanning rows for header "Ежемесячные доходы YYYY" / "Ежемесячные доходы" / "Источник доходов" / "Источники доходов" / "Доходы".
3. Year from trailing 4 digits in header.
4. Months in columns C..N (Январь..Декабрь), Всего in O.
5. Categories in column B rows until "Итого:"/"Итого".
6. For each category row, for each month column with numeric non-empty value → record.

## Recognition
- Year: regex /\b(20\d{2})\b/ in header text.
- Months: map Russian month names to 1..12.
- "Итого:" row: skip (validation only).

## Preview format
- years: number[]
- recordsCount: number
- totalByYear: {year: sum}
- errors: string[]

## Errors
- Missing year in header
- Non-numeric amount
- Total mismatch (sum months != Всего)
- Itogo mismatch
