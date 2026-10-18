import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { catchError, Observable, throwError } from 'rxjs';
import { ValueParams } from '../../shared/components/combobox/interfaces/search-param.interface';

export interface ZonePage { data: import('../../warehouses/interfaces/warehouse.interface').Zone[]; meta: { page: number; totalPages: number; total: number } }
export interface ZoneProductPage { data: { id: number; quantity: number; product: { id: number; name: string; type: string } }[]; meta: { page: number; totalPages: number; total: number } }
const baseUrl = environment.baseUrl;

@Injectable({
  providedIn: 'root',
})
export class ZoneService {
  http = inject(HttpClient);

  list(warehouseId: number, page: number, name: string): Observable<ZonePage> { return this.http.get<ZonePage>(`${baseUrl}/zones`, { params: { warehouseId, page, limit: 10, name } }); }
  products(zoneId: number, page: number): Observable<ZoneProductPage> { return this.http.get<ZoneProductPage>(`${baseUrl}/zones/${zoneId}/products`, { params: { page, limit: 10 } }); }
  create(warehouseId: number, name: string): Observable<unknown> { return this.http.post(`${baseUrl}/zones`, { warehouseId, name }); }
  update(id: number, name: string): Observable<unknown> { return this.http.patch(`${baseUrl}/zones/${id}`, { name }); }

  getZonesByName(
    limit: number,
    name: string,
    stockStatus?: 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK',
    warehouseId?: number | null,
    productId?: number | null,
  ): Observable<ValueParams[]> {
    return this.http
      .get<ValueParams[]>(`${baseUrl}/zones/search-by-name`, {
        params: {
          limit,
          name,
          ...(stockStatus ? { stockStatus } : {}),
          ...(warehouseId ? { warehouseId } : {}),
          ...(productId ? { productId } : {}),
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

  deleteZone(id: number): Observable<unknown> {
    return this.http
      .delete(`${baseUrl}/zones/${id}`)
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