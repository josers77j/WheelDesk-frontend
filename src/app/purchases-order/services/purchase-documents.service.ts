import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
export type PurchaseDocumentFormat = 'pdf' | 'json';
@Injectable({ providedIn: 'root' })
export class PurchaseDocumentsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.baseUrl}/purchase-orders`;
  status(id: number): Observable<{ pdf: string | null; json: string | null }> { return this.http.get<{ pdf: string | null; json: string | null }>(`${this.base}/${id}/documents`); }
  file(id: number, format: PurchaseDocumentFormat): Observable<HttpResponse<Blob>> { return this.http.get(`${this.base}/${id}/document-files/${format}`, { responseType: 'blob', observe: 'response' }); }
  zip(ids: number[], formats: PurchaseDocumentFormat[]): Observable<Blob> { return this.http.post(`${this.base}/documents/zip`, { ids, formats }, { responseType: 'blob' }); }
  email(id: number, recipient: string, formats: PurchaseDocumentFormat[]): Observable<unknown> { return this.http.post(`${this.base}/${id}/documents/email`, { recipient, formats }); }
}
