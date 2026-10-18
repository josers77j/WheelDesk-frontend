export interface CustomerResponse {
  data: Customer[];
  meta: Meta;
}

export interface Customer {
  id: number;
  name: string;
  isTaxPayer: boolean;
  email: string;
  phone: string;
  customerType: CUSTOMER_TYPE | null;
  districtId: number;
  address: string;
  createdById: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  district: District | null;
  /**
   * Relación 1-1 con la info fiscal: llega `null` cuando el cliente NO es
   * contribuyente (el POST/PATCH de no contribuyente ni siquiera manda el
   * objeto), igual que `district` con los que no trae relación. Por eso los
   * templates y el TS la tratan con `?.`.
   */
  taxInfo: TaxInfo | null;
}

export interface TaxInfo {
  id?: number;
  tradeName: string;
  customerId?: number;
  taxDocumentTypeId: number;
  economicActivity?: EconomicActivity;
  taxDocumentNumber: string;
  nrc: string;
  economicActivityId: number;
  createdAt?: Date;
  updatedAt?: Date;
  taxDocumentType?: TaxDocumentType;
}

export interface TaxDocumentType {
  id: number;
  code: string;
  name: string;
}

export interface District {
  id: number;
  name: string;
  municipality: Municipality;
}

export interface Municipality {
  id: number;
  name: string;
  department: Department;
}

export interface Department {
  id: number;
  name: string;
}

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export enum CUSTOMER_TYPE {
  NATURAL = 'NATURAL',
  LEGAL = 'LEGAL',
}

/**
 * MH codes (cat-022) of the document types whose number is written with
 * digits only: NIT (36) and DUI (13). The rest (passport, other, ...) accept
 * letters, so they must not be restricted.
 */
export enum TAX_DOCUMENT_TYPE_CODE {
  NIT = '36',
  DUI = '13',
}

export interface EconomicActivity {
  id: number;
  code: string;
  name: string;
  /** Compatibilidad con el payload real del backend (description) */
  description?: string;
  isLegacy?: boolean;
}

/** Fields sent to customer create/update endpoints, including explicit clearing. */
export interface CustomerPayload {
  name?: string | null;
  isTaxPayer?: boolean;
  email?: string | null;
  phone?: string | null;
  customerType?: CUSTOMER_TYPE | null;
  districtId?: number | null;
  address?: string | null;
  taxInfo?: CustomerTaxInfoPayload | null;
}

export interface CustomerTaxInfoPayload {
  tradeName: string;
  taxDocumentNumber: string;
  nrc: string;
  taxDocumentTypeId?: number | null;
  economicActivityId?: number | null;
}
