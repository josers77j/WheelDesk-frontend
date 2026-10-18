import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  QuotationDetail,
  QuotationResponse, QuotationWrite, QuotationPreview, QuotationFilters,
} from '../interfaces/quotation.interface';

@Injectable({ providedIn: 'root' })
export class QuotationService {
  private readonly http = inject(HttpClient);

  getQuotations(page: number, documentNumber: string, limit = 10, filters: QuotationFilters = {}): Observable<QuotationResponse> {
    const params: Record<string, string | number> = { page, limit, documentNumber };
    if (filters.customerId) params['customerId'] = filters.customerId;
    if (filters.from) params['from'] = filters.from;
    if (filters.to) params['to'] = filters.to;
    return this.http.get<QuotationResponse>(`${environment.baseUrl}/quotations`, { params });
  }
  create(payload: QuotationWrite): Observable<{ id: number; documentNumber: string }> { return this.http.post<{ id: number; documentNumber: string }>(`${environment.baseUrl}/quotations`, payload); }
  update(id: number, payload: QuotationWrite): Observable<{ id: number }> { return this.http.patch<{ id: number }>(`${environment.baseUrl}/quotations/${id}`, payload); }
  preview(payload: QuotationWrite): Observable<QuotationPreview> { return this.http.post<QuotationPreview>(`${environment.baseUrl}/quotations/preview`, payload); }
  sendEmail(id: number, email: string): Observable<{ message: string }> { return this.http.post<{ message: string }>(`${environment.baseUrl}/quotations/${id}/email`, { email }); }

  getQuotation(id: number): Observable<QuotationDetail> {
    return this.http.get<QuotationDetail>(
      `${environment.baseUrl}/quotations/${id}`,
    );
  }

  downloadPdf(id: number): Observable<Blob> {
    return this.http.get(`${environment.baseUrl}/quotations/${id}/pdf`, {
      responseType: 'blob',
    });
  }
}
