/** Tipo de documento del checkout (lo resuelve el front desde el catálogo). */
export enum CheckoutDocumentType {
  INVOICE = 'INVOICE',
  TAX_CREDIT = 'TAX_CREDIT',
}

export enum DiscountType {
  USD = 'USD',
  PERCENT = 'PERCENT',
}

/** Item de `GET /catalog/category/*`: { id, code, name }. */
export interface CatalogItem {
  id: number;
  code: string;
  name: string;
}

export type CatalogCategory =
  | 'document-type'
  | 'payment-methode'
  | 'payment-term'
  | 'contingency-type';

/** Códigos Hacienda del catálogo document-type. */
export const DTE_CATALOG_CODES = {
  INVOICE: '01',
  TAX_CREDIT: '03',
} as const;

export interface CheckoutItemPayload {
  productId: number;
  productName: string;
  quantity: number;
  zoneId: number;
  unitPrice?: number;
  discountType?: DiscountType;
  discountValue?: number;
}

export interface CheckoutPaymentPayload {
  amount: number;
  paymentMethodId: number;
  code: string;
  name: string;
}

export interface CheckoutPayload {
  quotationId?: number;
  requestId: string;
  documentType: CheckoutDocumentType;
  customerId?: number;
  documentTypeId: number;
  items: CheckoutItemPayload[];
  discountType?: DiscountType;
  discountValue?: number;
  paymentMethod: CheckoutPaymentPayload[];
  paymentTermId?: number;
}

export interface CheckoutResponse {
  requestId: string;
  saleOrderId: number;
  status: string;
  finalized: true;
  emailStatus: 'not_requested' | 'sent' | 'failed';
  message: string;
}

/** Línea del borrador (incluye datos de UI para no re-pedirlos). */
export interface CheckoutDraftItem {
  productId: number;
  name: string;
  quantity: number;
  zoneId: number | null;
  zoneName: string | null;
  unitPrice: number | null;
  /** Precio estimado (solo UI: el servidor lo usa si no se asigna otro). */
  unitPriceEstimate: string;
  lineTotal: string;
  discountType: DiscountType | null;
  discountValue: number | null;
}

export interface CheckoutDraftPayment {
  paymentMethodId: number | null;
  code: string;
  name: string;
  amount: number;
}

/** Borrador persistido en localStorage (incluye el requestId). */
export interface CheckoutDraft {
  quotationId: number | null;
  requestId: string;
  documentType: CheckoutDocumentType;
  documentTypeId: number | null;
  customerId: number | null;
  customerName: string | null;
  items: CheckoutDraftItem[];
  discountType: DiscountType | null;
  discountValue: number | null;
  payments: CheckoutDraftPayment[];
  paymentTermId: number | null;
}
