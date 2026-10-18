import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import {
  SaleOrder,
  SaleOrderResponse,
  SaleOrderSearchParams,
  SaleDocumentsResponse,
} from '../interfaces/sale-order.interface';
import type {
  CheckoutPayload,
  CheckoutResponse,
} from '../interfaces/checkout.interface';
import { environment } from '../../../environments/environment';
import { catchError, Observable, throwError } from 'rxjs';

const baseUrl = environment.baseUrl;

@Injectable({
  providedIn: 'root',
})
export class SaleOrderService {
  selectedSaleOrderId = signal<number>(0);

  http = inject(HttpClient);

  getSaleOrders(
    searchParams: SaleOrderSearchParams,
    limit: number,
    page: number,
  ): Observable<SaleOrderResponse> {
    // Los vacíos no se envían: el backend rechaza con 400 los enums
    // (@IsEnum) recibidos como string vacío.
    const raw: Record<string, unknown> = {
      from: searchParams.from,
      to: searchParams.to,
      search: searchParams.search,
      minTotal: searchParams.minTotal,
      maxTotal: searchParams.maxTotal,
      status: searchParams.status,
      dteType: searchParams.dteType,
      limit,
      page,
    };
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value === undefined || value === null || value === '') continue;
      params[key] = value as string | number;
    }
    return this.http
      .get<SaleOrderResponse>(`${baseUrl}/sale-orders`, { params })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception?.['error']?.message ?? 'Error de red',
            status: exception?.['error']?.statusCode ?? exception?.status ?? 0,
          }));
        }),
      );
  }

  getSaleOrder(id: number): Observable<SaleOrder> {
    return this.http.get<SaleOrder>(`${baseUrl}/sale-orders/${id}`).pipe(
      catchError((exception) => {
        return throwError(() => ({
          message: exception['error'].message,
          status: exception['error'].statusCode,
        }));
      }),
    );
  }

  getDocuments(orderId: number): Observable<SaleDocumentsResponse> {
    return this.http
      .post<SaleDocumentsResponse>(
        `${baseUrl}/sale-orders/${orderId}/documents`,
        {},
      )
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception?.['error']?.message ?? 'Error de red',
            status: exception?.['error']?.statusCode ?? exception?.status ?? 0,
          }));
        }),
      );
  }

  downloadOrderZip(orderId: number) {
    return this.http
      .get(`${baseUrl}/sale-orders/${orderId}/documents-zip`, {
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: 'Error al generar el ZIP',
            status: exception?.status ?? 0,
          }));
        }),
      );
  }

  downloadExcelSummary(from?: string, to?: string) {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http
      .get(`${baseUrl}/sale-orders/excel-summary`, {
        params,
        responseType: 'blob',
      })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: 'Error al generar el Excel',
            status: exception?.status ?? 0,
          }));
        }),
      );
  }

  requestDocumentsZip(from?: string, to?: string): Observable<HttpResponse<Blob>> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.post(`${baseUrl}/sale-orders/zip`, {}, {
      params, responseType: 'blob', observe: 'response',
    });
  }

  /**
   * Creates a completed sale. Si el `requestId` ya fue procesado, el backend
   * responde 200 con la orden existente (sin duplicar).
   */
  checkout(payload: CheckoutPayload, files: readonly File[] = []): Observable<CheckoutResponse> {
    let body: CheckoutPayload | FormData = payload;
    if (files.length > 0) {
      const multipart = new FormData();
      multipart.append('payload', JSON.stringify(payload));
      files.forEach((file) => multipart.append('files', file));
      body = multipart;
    }
    return this.http
      .post<CheckoutResponse>(`${baseUrl}/sale-orders/checkout`, body)
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception?.['error']?.message ?? 'Error de red',
            status: exception?.['error']?.statusCode ?? exception?.status ?? 0,
          }));
        }),
      );
  }
  sendEmail(id: number, options: { recipient?: 'client' | 'manual'; email?: string; attachments?: ('pdf' | 'json')[] } = {}): Observable<{ emailStatus: 'sent' | 'failed' | 'not_requested'; message: string }> {
    return this.http.post<{ emailStatus: 'sent' | 'failed' | 'not_requested'; message: string }>(
      `${baseUrl}/sale-orders/${id}/email`, options,
    );
  }

}
