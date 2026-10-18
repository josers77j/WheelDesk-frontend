export interface MigrationPreviewItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  match: 'match' | 'create';
  productId?: number;
}

export interface MigrationPreviewFile {
  filename: string;
  hasPdf: boolean;
  version: number | null;
  tipoDte: string | null;
  controlNumber: string | null;
  generationCode: string | null;
  fecEmi: string | null;
  sello: boolean;
  customer: { mode: 'generic' | 'match' | 'create'; key: string; customerId?: number };
  items: MigrationPreviewItem[];
  unknownCatalogs: { itemTypes: string[]; units: string[]; payments: string[] };
  duplicate: boolean;
  errors: string[];
}

export interface MigrationImportResult {
  total: number;
  summary: { migrated: number; skipped: number; failed: number };
  errors: { filename: string; detail: string }[];
  orphans: string[];
  attached: { stem: string; controlNumber: string }[];
}
