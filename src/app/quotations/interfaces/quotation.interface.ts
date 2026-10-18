import { CheckoutDocumentType, DiscountType } from '../../sale-orders/interfaces/checkout.interface';
export interface QuotationSummary {
  id: number;
  documentNumber: string;
  customerName: string | null;
  customerAddress: string | null;
  customer: { name: string } | null;
  subtotal: string;
  iva: string;
  globalDiscount: string;
  total: string;
  notes: string | null;
  createdAt: string;
}

export interface QuotationDetail extends QuotationSummary {
  saleType: CheckoutDocumentType | null;
  customerId: number | null;
  details: QuotationItem[];
}

export interface QuotationItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  discountAmount: string;
  amountAfterDiscount: string;
  taxAmount: string;
}

export interface QuotationResponse {
  data: QuotationSummary[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface QuotationLineInput { productId: number; productName: string; quantity: number; unitPrice: number; discountType?: DiscountType; discountValue?: number; }
export interface QuotationWrite { customerId: number | null; customerName: string | null; customerAddress: string | null; notes: string | null; saleType: CheckoutDocumentType; discountType?: DiscountType; discountValue?: number; details: QuotationLineInput[]; }
export interface QuotationPreview { details: { subtotal: string; discountAmount: string; amountAfterDiscount: string; taxAmount: string; unitPrice: string }[]; header: { subtotal: string; iva: string; total: string; globalDiscount: string }; }
export interface QuotationFilters { documentNumber?: string; customerId?: number; from?: string; to?: string; }
