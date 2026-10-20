import { PurchaseSourcePreview } from './assisted-purchase.interface';
import { PURCHASE_ORDER_STATUS } from '../enums/purchase-order-status.enum';

export interface PurchaseOrderResponse {
  data: PurchaseOrder[];
  meta: Meta;
}

export interface PurchaseOrder {
  sourceIdentity?: string | null;
  destinationWarehouse?: { id: number; name: string } | null;
  document?: {
    pdfKey?: string | null;
    jsonKey?: string | null;
    source?: string;
    sourceSnapshot?: Omit<PurchaseSourcePreview, 'providerMatch' | 'brands'> & {
      pdfConfirmed?: boolean;
    };
  } | null;
  id: number;
  documentNumber: number;
  documentType: string;
  providerId: number;
  total: string;
  status: PURCHASE_ORDER_STATUS;
  canceledById: null;
  createdById: number | null;
  updatedById: number | null;
  createdAt: Date;
  updatedAt: Date;
  canceledAt: null;
  provider: Provider;
  createdBy: Provider | null;
  details: Detail[];
}

export interface Provider {
  id: number;
  name: string;
}
export interface Product {
  type?: 'TIRE' | 'SUPPLY' | 'SERVICE';
  id: number;
  name: string;
}

export interface Detail {
  id: number;
  product: Product;
  unitPrice: string;
  quantity: number;
  subtotal: string;
  suggestedZoneId: number | null;
  suggestedZone: SuggestedZone | null;
}

export interface SuggestedZone {
  id: number;
  name: string;
  warehouseId: number;
  warehouse: {
    id: number;
    name: string;
  };
}

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PurchaseOrderDetail {
  providerId: number;
  details: ProductDetail[];
}
export interface ProductDetail {
  productId?: number;
  name?: string;
  quantity?: number;
  unitPrice?: string;
  subtotal?: string;
  suggestedZoneId?: number | null;
  /** Solo visualización en el form; no se envía al back. */
  suggestedZoneName?: string | null;
}

/** Allocation de una parte del detalle a una zona (approve-order). */
export interface ZoneAllocation {
  zoneId: number;
  quantity: number;
}

/**
 * Vista previa de zonas (GET /purchase-orders/:id/zone-preview): a qué zona
 * resuelve cada detalle si la orden se confirma tal cual. `zoneId` en null
 * significa que el detalle no tiene zona asignada todavía.
 */
export interface PurchaseOrderZonePreview {
  purchaseOrderDetailId: number;
  productId: number;
  productName: string;
  quantity: number;
  zoneId: number | null;
  zoneName: string | null;
  warehouseId: number | null;
  warehouseName: string | null;
}

/** Confirmación de un detalle al aprobar: a qué zonas va cada cantidad. */
export interface ConfirmPurchaseOrderDetail {
  purchaseOrderDetailId: number;
  allocations: ZoneAllocation[];
}
