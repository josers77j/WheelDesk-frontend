import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AssistedPurchasePayload,
  PurchaseProviderDraft,
  PurchaseSourcePreview,
} from '../interfaces/assisted-purchase.interface';

@Injectable({ providedIn: 'root' })
export class AssistedPurchaseService {
  private readonly http = inject(HttpClient);
  preview(file: File): Observable<PurchaseSourcePreview> {
    const form = new FormData();
    form.append('files', file);
    return this.http.post<PurchaseSourcePreview>(
      `${environment.baseUrl}/purchase-orders/assisted-preview`,
      form,
    );
  }
  matchProvider(
    nrc: string,
    nit: string,
  ): Observable<({ id: number } & PurchaseProviderDraft) | null> {
    return this.http.post<({ id: number } & PurchaseProviderDraft) | null>(
      `${environment.baseUrl}/purchase-orders/assisted-provider-match`,
      { nrc, nit },
    );
  }
  save(
    payload: AssistedPurchasePayload,
    files: readonly File[],
  ): Observable<{ id: number; documentNumber: number; replayed: boolean }> {
    const form = new FormData();
    form.append('payload', JSON.stringify(payload));
    for (const file of files) form.append('files', file);
    return this.http.post<{
      id: number;
      documentNumber: number;
      replayed: boolean;
    }>(`${environment.baseUrl}/purchase-orders/assisted`, form);
  }
  update(
    id: number,
    payload: AssistedPurchasePayload,
  ): Observable<{ id: number; documentNumber: number; replayed: boolean }> {
    return this.http.patch<{
      id: number;
      documentNumber: number;
      replayed: boolean;
    }>(`${environment.baseUrl}/purchase-orders/assisted/${id}`, payload);
  }
  documents(
    id: number,
  ): Observable<{ pdf: string | null; json: string | null }> {
    return this.http.get<{ pdf: string | null; json: string | null }>(
      `${environment.baseUrl}/purchase-orders/${id}/documents`,
    );
  }
}
