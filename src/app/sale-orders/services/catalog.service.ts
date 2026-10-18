import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  CatalogCategory,
  CatalogItem,
} from '../interfaces/checkout.interface';

const baseUrl = environment.baseUrl;

/** Catálogos de Hacienda (`GET /catalog/category/:catalog`). */
@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  http = inject(HttpClient);

  getCatalog(category: CatalogCategory): Observable<CatalogItem[]> {
    return this.http
      .get<CatalogItem[]>(`${baseUrl}/catalog/category/${category}`)
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception?.['error']?.message ?? 'Error de red',
            status: exception?.['error']?.statusCode ?? exception?.status ?? 0,
          }));
        }),
      );
  }
}
