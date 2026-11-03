import { describe, it, expect } from 'vitest';
import { parseExcelFile, validateParsedData } from '.';

describe('excel parser scaffold', () => {
  it('returns not implemented preview', async () => {
    const file = new File([''], 'test.xlsx');
    const preview = await parseExcelFile(file);
    expect(preview.recordsCount).toBe(0);
    expect(preview.errors.length).toBeGreaterThan(0);
  });

  it('validates empty preview', () => {
    expect(validateParsedData({ years: [], recordsCount: 0, totalByYear: {}, errors: [] })).toEqual([]);
  });
});
