import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { catchError, Observable, of, throwError } from 'rxjs';
import {
  CreateTransferPayload,
  Transfer,
  TransferResponse,
} from '../interfaces/transfer.interface';
import { TRANSFER_STATUS } from '../enums/transfer-status.enum';

const baseUrl = environment.baseUrl;

export const emptyTransfer: Transfer = {
  id: 0,
  fromZoneId: 0,
  toZoneId: 0,
  status: TRANSFER_STATUS.PENDING,
  createdById: null,
  createdAt: new Date(),
  updatedAt: null,
  fromZone: null,
  toZone: null,
  createdBy: null,
  details: [],
};
@Injectable({
  providedIn: 'root',
})
export class TransferService {
  http = inject(HttpClient);
  transferIdSelected = signal<number>(0);

  getTransfers(
    page = 1,
    limit = 10,
    status = '',
    from?: string | null,
    to?: string | null,
  ): Observable<TransferResponse> {
    // Los vacíos no se envían.
    const raw: Record<string, unknown> = { page, limit, status, from, to };
    const params: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value === undefined || value === null || value === '') continue;
      params[key] = value as string | number;
    }
    return this.http
      .get<TransferResponse>(`${baseUrl}/transfers`, { params })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  getTransferById(id: number): Observable<Transfer> {
    if (id === 0) {
      return of(emptyTransfer);
    }

    return this.http.get<Transfer>(`${baseUrl}/transfers/${id}`);
  }

  createTransfer(
    payload: CreateTransferPayload,
  ): Observable<{ transferId: number; status: string; movementsCreated: number }> {
    return this.http
      .post<{ transferId: number; status: string; movementsCreated: number }>(
        `${baseUrl}/transfers`,
        payload,
      )
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  updateTransfer(id: number, details: { productId: number; quantity: number }[]): Observable<Transfer> {
    return this.http
      .patch<Transfer>(`${baseUrl}/transfers/${id}`, {
        details,
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

  cancelTransfer(id: number): Observable<Transfer> {
    return this.http.delete<Transfer>(`${baseUrl}/transfers/${id}`).pipe(
      catchError((exception) => {
        return throwError(() => ({
          message: exception['error'].message,
          status: exception['error'].statusCode,
        }));
      }),
    );
  }
}