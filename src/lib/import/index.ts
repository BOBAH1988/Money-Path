// Empty, typed scaffold for the Excel import module.
// Implementation will be added in the next step.

import type { ParsePreview } from '../../types';

export interface ExcelParser {
  parseFile(file: File): Promise<ParsePreview>;
  validate(): string[];
}

export const parseExcelFile = async (_file: File): Promise<ParsePreview> => {
  // TODO: implement parsing according to docs/import-spec.md
  return { years: [], recordsCount: 0, totalByYear: {}, errors: ['Not implemented'] };
};

export const validateParsedData = (_preview: ParsePreview): string[] => {
  return [];
};
