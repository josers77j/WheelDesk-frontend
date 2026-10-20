import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import {
  ConfirmPurchaseOrderDetail,
  Detail,
  Product,
  Provider,
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseOrderResponse,
  PurchaseOrderZonePreview,
} from '../interfaces/purchase-order.interface';
import { environment } from '../../../environments/environment';
import { SearchParams } from '../interfaces/search-param.interface';
import { catchError, Observable, of, throwError } from 'rxjs';
import { PURCHASE_ORDER_STATUS } from '../enums/purchase-order-status.enum';

const baseUrl = environment.baseUrl;
export const emptyProvider: Provider = {
  id: 0,
  name: '',
};

export const emptyProduct: Product = {
  id: 0,
  name: '',
};

export const emptyDetail: Detail = {
  id: 0,
  product: emptyProduct,
  unitPrice: '0',
  quantity: 0,
  subtotal: '0',
  suggestedZoneId: null,
  suggestedZone: null,
};
export const emptyPurchaseOrder: PurchaseOrder = {
  id: 0,
  documentNumber: 0,
  documentType: '',
  providerId: 0,
  total: '0',
  status: PURCHASE_ORDER_STATUS.PENDING, // cambia si tu enum usa otro valor
  canceledById: null,
  createdById: null,
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  canceledAt: null,
  provider: emptyProvider,
  createdBy: null,
  details: [],
};
@Injectable({
  providedIn: 'root',
})
export class PurchaseOrderService {
  selectedPurchaseOrderId = signal<number>(0);

  http = inject(HttpClient);

  getPurchaseOrders(searchParams: SearchParams, limit: number, page: number) {
    const { from, to, documentNumber, status, providerId } = searchParams;
    return this.http
      .get<PurchaseOrderResponse>(`${baseUrl}/purchase-orders`, {
        params: {
          from: from ?? '',
          to: to ?? '',
          documentNumber: documentNumber?.trim() ?? '',
          status: status ?? '',
          providerId: providerId ?? '',
          limit,
          page,
        },
      })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  rejectPurchaseOrder(id: number) {
    return this.http
      .delete<PurchaseOrder>(`${baseUrl}/purchase-orders/reject-order/${id}`)
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  approvePurchaseOrder(id: number, details?: ConfirmPurchaseOrderDetail[]) {
    return this.http
      .post<PurchaseOrder>(`${baseUrl}/purchase-orders/approve-order/${id}`, {
        ...(details !== undefined ? { details } : {}),
      })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  getPurchaseOrder(id: number): Observable<PurchaseOrder> {
    if (id === 0) return of(emptyPurchaseOrder);

    return this.http
      .get<PurchaseOrder>(`${baseUrl}/purchase-orders/${id}`)
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  /**
   * Zonas sugeridas por detalle: qué zona usaría la orden si se confirma tal
   * cual. Un detalle sin sugerencia vuelve con `zoneId: null`.
   */
  getZonePreview(id: number): Observable<PurchaseOrderZonePreview[]> {
    if (id === 0) return of([]);

    return this.http
      .get<PurchaseOrderZonePreview[]>(`${baseUrl}/purchase-orders/${id}/zone-preview`)
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  createPurchaseOrder(purchaseOrder: Partial<PurchaseOrderDetail>) {
    const { providerId, details } = purchaseOrder;

    const detailMapped = details!.map((detail) => ({
      productId: detail.productId,
      productName: detail.name,
      quantity: detail.quantity,
      unitPrice: detail.unitPrice,
      // La zona sugerida es opcional: si queda vacía no se envía.
      ...(detail.suggestedZoneId ? { suggestedZoneId: detail.suggestedZoneId } : {}),
    }));

    return this.http
      .post<PurchaseOrder>(`${baseUrl}/purchase-orders`, {
        providerId,
        details: [...detailMapped],
      })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  updatePurchaseOrder(id: number, purchaseOrder: Partial<PurchaseOrderDetail>) {
    const { details } = purchaseOrder;

    const detailMapped = details!.map((detail) => ({
      productId: detail.productId,
      productName: detail.name,
      quantity: detail.quantity,
      unitPrice: detail.unitPrice,
      // La zona sugerida es opcional: si queda vacía no se envía.
      ...(detail.suggestedZoneId ? { suggestedZoneId: detail.suggestedZoneId } : {}),
    }));

    return this.http
      .patch<PurchaseOrder>(`${baseUrl}/purchase-orders/${id}`, {
        details: [...detailMapped],
      })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }
}
