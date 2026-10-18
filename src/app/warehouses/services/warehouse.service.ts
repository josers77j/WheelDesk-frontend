import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { catchError, Observable, of, throwError } from 'rxjs';
import {
  CreateWarehousePayload,
  Warehouse,
  WarehouseResponse,
} from '../interfaces/warehouse.interface';
import { ValueParams } from '../../shared/components/combobox/interfaces/search-param.interface';

const baseUrl = environment.baseUrl;

const emptyWarehouse: Warehouse = {
  id: 0,
  name: '',
  address: '',
  zones: [],
  createdAt: new Date(),
  updatedAt: null,
  deletedAt: null,
};
@Injectable({
  providedIn: 'root',
})
export class WarehouseService {
  http = inject(HttpClient);
  warehouseIdSelected = signal<number>(0);

  getWarehouses(
    page = 1,
    limit = 10,
    name = '',
  ): Observable<WarehouseResponse> {
    return this.http
      .get<WarehouseResponse>(`${baseUrl}/warehouses`, {
        params: {
          page,
          limit,
          name,
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

  getWarehouseById(id: number): Observable<Warehouse> {
    if (id === 0) {
      return of(emptyWarehouse);
    }

    return this.http.get<Warehouse>(`${baseUrl}/warehouses/${id}`);
  }

  /** Búsqueda liviana para combobox en cascada (bodega → zona). */
  searchWarehousesByName(
    limit: number,
    name: string,
    productId?: number | null,
    stockStatus?: 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK',
  ): Observable<ValueParams[]> {
    return this.http
      .get<ValueParams[]>(`${baseUrl}/warehouses/search-by-name`, {
        params: {
          limit,
          name,
          ...(productId !== undefined && productId !== null ? { productId } : {}),
          ...(stockStatus ? { stockStatus } : {}),
        },
      })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error']?.message ?? 'Error de red',
            status: exception['error']?.statusCode ?? exception?.status ?? 0,
          }));
        }),
      );
  }

  createWarehouse(
    warehouseLike: Partial<CreateWarehousePayload>,
  ): Observable<Warehouse> {
    return this.http
      .post<Warehouse>(`${baseUrl}/warehouses`, {
        ...warehouseLike,
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

  updateWarehouse(
    id: number,
    warehouseLike: Partial<CreateWarehousePayload>,
  ): Observable<Warehouse> {
    return this.http
      .patch<Warehouse>(`${baseUrl}/warehouses/${id}`, {
        ...warehouseLike,
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

  deleteWarehouse(id: number): Observable<Warehouse> {
    return this.http.delete<Warehouse>(`${baseUrl}/warehouses/${id}`).pipe(
      catchError((exception) => {
        return throwError(() => ({
          message: exception['error'].message,
          status: exception['error'].statusCode,
        }));
      }),
    );
  }
}