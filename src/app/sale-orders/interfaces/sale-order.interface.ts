import { SALE_ORDER_STATUS } from '../enums/sale-order-status.enum';

export interface SaleOrderResponse {
  data: SaleOrder[];
  meta: SaleOrderMeta;
}

export interface SaleOrder {
  id: number;
  customerId: number | null;
  documentNumber: string;
  documentType: string;
  documentTypeCode: string;
  subtotal: string;
  iva: string;
  total: string;
  globalDiscount: string;
  status: SALE_ORDER_STATUS;
  customerName: string | null;
  customerDocumentNumber: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { name: string } | null;
  details: SaleOrderDetail[];
  document: { pdfKey: string | null; jsonKey: string | null; externalId?: string | null } | null;
  payments: { id: number; amount: string; paymentMethodId: number; paymentMethod?: { name: string; code: string } }[];
}

export interface SaleOrderDetail {
  product: { id: number; name: string };
  unitPrice: string;
  quantity: number;
  subtotal: string;
  zone?: { id: number; name: string } | null;
}

export interface SaleDocumentFile {
  key: string;
  url: string;
}

export interface SaleDocumentsResponse {
  pdf: SaleDocumentFile | null;
  json: SaleDocumentFile;
  cached: boolean;
  filename: string;
}

export interface SaleOrderMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface SaleOrderSearchParams {
  from?: string | null;
  to?: string | null;
  /** Búsqueda unificada: documento o cliente. */
  search?: string;
  /** Rango de montos; viajan como texto porque salen de la URL. */
  minTotal?: string;
  maxTotal?: string;
  status?: string;
  dteType?: string;
}
