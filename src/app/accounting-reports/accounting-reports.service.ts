import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import type { InvoicePeriods } from '../shared/utils/invoice-periods';
export type ReportPeriod = InvoicePeriods;
export type ReportFormat = 'pdf' | 'json' | 'excel';
export interface ReportDownload { url: string; filename: string; expiresIn: number }
@Injectable({ providedIn: 'root' })
export class AccountingReportsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.baseUrl}/accounting-reports`;
  period() { return this.http.get<ReportPeriod>(`${this.base}/period`); }
  export(from: string, to: string, formats: ReportFormat[]) {
    return this.http.post<ReportDownload>(`${this.base}/export`, {}, { params: { from, to, formats: formats.join(',') } });
  }
}
