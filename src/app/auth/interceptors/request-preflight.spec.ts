import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { of, type Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';
import { environment } from '../../../environments/environment';
import type { UserRole } from '../../users/interfaces/user.interface';

// Assertions inspect the transport, not only the validation error.
describe('local API preflight', (): void => {
  let http: HttpClient;
  let transport: HttpTestingController;
  const role = signal<UserRole | undefined>('ADMIN');
  beforeEach((): void => {
    role.set('ADMIN');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            user: (): { role: UserRole | undefined } => ({ role: role() }),
            refreshSession: (): Observable<boolean> => of(true),
          },
        },
        { provide: Router, useValue: {} },
      ],
    });
    http = TestBed.inject(HttpClient);
    transport = TestBed.inject(HttpTestingController);
  });
  afterEach((): void => transport.verify());
  function rejected(
    path: string,
    status: number,
    method = 'GET',
    body: unknown = null,
  ): void {
    let received: unknown;
    http.request(method, `${environment.baseUrl}${path}`, { body }).subscribe({
      error: (error: unknown): void => {
        received = error;
      },
    });
    expect(received instanceof HttpErrorResponse).toBeTrue();
    if (received instanceof HttpErrorResponse)
      expect(received.status).toBe(status);
    transport.expectNone(() => true);
  }
  it('blocks reversed and excessive ranges without sending HTTP', (): void => {
    rejected('/dashboard/summary?from=2024-12-31&to=2024-01-01', 400);
    rejected('/sale-orders/zip?from=2024-01-01&to=2025-01-01', 400, 'POST', {});
    rejected('/sale-orders/excel-summary?from=2024-02-30&to=2024-03-01', 400);
  });
  it('restricts accountants and rejects invalid report requests locally', (): void => {
    role.set('ACCOUNTANT');
    rejected('/products', 403);
    rejected('/accounting-reports/export?from=2026-02-01&to=2026-03-04&format=zip', 400, 'POST');
    rejected('/accounting-reports/export?from=2099-01-01&to=2099-01-02&format=excel', 400, 'POST');
    rejected('/accounting-reports/export?from=2026-02-01&to=2026-02-02', 400, 'POST');
    role.set('VIEWER'); rejected('/accounting-reports/period', 403);
  });
  it('blocks invalid lookup inputs without sending HTTP', (): void => {
    rejected('/products/summary?limit=101', 400);
    rejected('/products/summary?quantityStatus=INVALID', 400);
    rejected('/warehouses/search-by-name?limit=NaN', 400);
    rejected('/warehouses/search-by-name?productId=-1', 400);
  });
  it('blocks VIEWER mutations and admin-only reads locally', (): void => {
    role.set('VIEWER');
    rejected('/transfers/1', 403, 'DELETE');
    rejected('/products/create-tire', 403, 'POST', {});
    rejected('/users', 403);
  });
  it('does not allow writes before permissions are known, but permits login', (): void => {
    role.set(undefined);
    rejected('/products/create-tire', 403, 'POST', {});
    const url = `${environment.baseUrl}/auth/login`;
    http.post(url, {}).subscribe();
    transport.expectOne(url).flush({});
  });

  it('allows VIEWER read, logout and valid report download', (): void => {
    role.set('VIEWER');
    for (const [method, path] of [
      ['GET', '/products'],
      ['POST', '/auth/logout'],
      ['POST', '/sale-orders/zip?from=2024-01-01&to=2024-12-31'],
    ]) {
      const url = `${environment.baseUrl}${path}`;
      http.request(method, url).subscribe();
      transport.expectOne(url).flush({});
    }
  });
  it('blocks financial dashboard requests for every non-admin role before transport', (): void => {
    for (const restricted of ['SELLER', 'VIEWER', 'ACCOUNTANT'] as const) {
      role.set(restricted);
      rejected('/dashboard/period', 403);
      rejected('/dashboard/summary?from=2026-10-01&to=2026-10-17', 403);
    }
  });
  it('blocks oversized JSON and PDF before transport', (): void => {
    for (const extension of ['json', 'pdf']) {
      const body = new FormData();
      body.append(
        'files',
        new File([new Uint8Array(512 * 1024 + 1)], `example.${extension}`),
      );
      rejected('/migration/invoices/preview', 413, 'POST', body);
    }
  });
  it('allows exactly 512 KiB', (): void => {
    const url = `${environment.baseUrl}/migration/invoices/preview`;
    const body = new FormData();
    body.append(
      'files',
      new File([new Uint8Array(512 * 1024)], 'example.json'),
    );
    http.post(url, body).subscribe();
    transport.expectOne(url).flush({});
  });
});
