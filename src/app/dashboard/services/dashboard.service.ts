import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import type { InvoicePeriods } from '../../shared/utils/invoice-periods';
import type { DashboardSummary } from '../models/dashboard.model';

const baseUrl = `${environment.baseUrl}/dashboard`;

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  getPeriod(): Observable<InvoicePeriods> { return this.http.get<InvoicePeriods>(`${baseUrl}/period`); }

  getSummary(from?: string, to?: string) {
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    return this.http.get<DashboardSummary>(`${baseUrl}/summary`, { params });
  }
}
