import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type {
  AuditListResponse,
  AuditSearchParams,
} from '../interfaces/audit.interface';

const baseUrl = `${environment.baseUrl}/audit`;

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);

  getLogs(params: AuditSearchParams) {
    let httpParams = new HttpParams()
      .set('page', params.page)
      .set('limit', params.limit);
    if (params.action) httpParams = httpParams.set('action', params.action);
    if (params.entityType) httpParams = httpParams.set('entityType', params.entityType);
    if (params.entityId) httpParams = httpParams.set('entityId', params.entityId);
    if (params.userId) httpParams = httpParams.set('userId', params.userId);
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    return this.http.get<AuditListResponse>(baseUrl, { params: httpParams });
  }
}
