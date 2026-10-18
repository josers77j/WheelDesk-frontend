import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Provider, ProviderResponse } from '../interfaces/provider.interface';
import { environment } from '../../../environments/environment';
import { catchError, Observable, of, throwError } from 'rxjs';
import { ValueParams } from '../../shared/components/combobox/interfaces/search-param.interface';

const baseUrl = environment.baseUrl;
const emptyProvider: Provider = {
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
export class ProviderService {
  http = inject(HttpClient);
  providerIdSelected = signal<number>(0);

  getProviders(
    page: number,
    limit: number,
    name: string,
  ): Observable<ProviderResponse> {
    return this.http
      .get<ProviderResponse>(`${baseUrl}/providers`, {
        params: { page, limit, name },
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

  getProviderById(id: number): Observable<Provider> {
    if (id === 0) {
      return of(emptyProvider);
    }

    return this.http.get<Provider>(`${baseUrl}/providers/${id}`).pipe(
      catchError((exception) => {
        return throwError(() => ({
          message: exception['error'].message,
          status: exception['error'].statusCode,
        }));
      }),
    );
  }

  createProvider(providerLike: Partial<Provider>): Observable<Provider> {
    return this.http
      .post<Provider>(`${baseUrl}/providers`, {
        name: providerLike.name,
        description: providerLike.description,
        nrc: providerLike.nrc, nit: providerLike.nit,
        phone: providerLike.phone, email: providerLike.email,
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

  updateProvider(
    id: number,
    providerLike: Partial<Provider>,
  ): Observable<Provider> {
    return this.http
      .patch<Provider>(`${baseUrl}/providers/${id}`, {
        ...providerLike,
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

  deleteProvider(id: number): Observable<Provider> {
    return this.http.delete<Provider>(`${baseUrl}/providers/${id}`).pipe(
      catchError((exception) => {
        return throwError(() => ({
          message: exception['error'].message,
          status: exception['error'].statusCode,
        }));
      }),
    );
  }

  getProviderByName(limit: number, name: string): Observable<ValueParams[]> {
    return this.http
      .get<ValueParams[]>(`${baseUrl}/providers/search-by-name/`, {
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
