import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { catchError, Observable, of, throwError } from 'rxjs';
import { Brand, BrandResponse } from '../interfaces/brand.interface';
import { ValueParams } from '../../shared/components/combobox/interfaces/search-param.interface';

const baseUrl = environment.baseUrl;
const emptyBrand: Brand = {
  id: 0,
  name: '',
  description: '',
  createdAt: new Date(),
  updatedAt: null,
  deletedAt: null,
};
@Injectable({
  providedIn: 'root',
})
export class BrandService {
  http = inject(HttpClient);
  brandIdSelected = signal<number>(0);

  getBrands(
    page = 1,
    limit = 10,
    name = '',
  ): Observable<BrandResponse> {
    return this.http
      .get<BrandResponse>(`${baseUrl}/brand`, {
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

  getBrandById(id: number): Observable<Brand> {
    if (id === 0) {
      return of(emptyBrand);
    }

    return this.http.get<Brand>(`${baseUrl}/brand/${id}`);
  }

  createBrand(brandLike: Partial<Brand>): Observable<Brand> {
    return this.http
      .post<Brand>(`${baseUrl}/brand`, {
        ...brandLike,
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

  updateBrand(id: number, brandLike: Partial<Brand>): Observable<Brand> {
    return this.http
      .patch<Brand>(`${baseUrl}/brand/${id}`, {
        ...brandLike,
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

  deleteBrand(id: number): Observable<Brand> {
    return this.http.delete<Brand>(`${baseUrl}/brand/${id}`).pipe(
      catchError((exception) => {
        return throwError(() => ({
          message: exception['error'].message,
          status: exception['error'].statusCode,
        }));
      }),
    );
  }

  getBrandByName(limit: number, name: string): Observable<ValueParams[]> {
    return this.http
      .get<ValueParams[]>(`${baseUrl}/brand/search-by-name/`, {
        params: {
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
}
