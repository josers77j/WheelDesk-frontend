import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AUTH_STATUS, AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor migration authorization', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let refreshSession: jasmine.Spy;
  let navigate: jasmine.Spy;
  let endSession: jasmine.Spy;
  let status: string;

  beforeEach((): void => {
    status = AUTH_STATUS.AUTHENTICATED;
    endSession = jasmine.createSpy('endSession').and.callFake((): void => { status = AUTH_STATUS.NOT_AUTHENTICATED; });
    refreshSession = jasmine.createSpy('refreshSession').and.returnValue(of(true));
    navigate = jasmine.createSpy('navigate');
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { user: (): { role: 'ADMIN' } => ({ role: 'ADMIN' }), refreshSession, endSession, authStatus: (): string => status } },
      { provide: Router, useValue: { navigate } },
    ] });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    // Reset the interceptor's redirect burst state between randomized test cases.
    http.get('/api/auth/profile').subscribe();
    controller.expectOne('/api/auth/profile').flush({});
  });

  afterEach((): void => controller.verify());

  it('propagates an incorrect migration password without refreshing or retrying', (): void => {
    let received: unknown;
    http.post('/api/migration/unlock', { password: 'incorrect' }).subscribe({ error: (error: unknown): void => { received = error; } });
    controller.expectOne('/api/migration/unlock').flush({ message: 'Contraseña incorrecta' }, { status: 401, statusText: 'Unauthorized' });
    expect(refreshSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    controller.expectNone('/api/migration/unlock');
    expect(received instanceof HttpErrorResponse).toBeTrue();
  });

  for (const url of ['/api/migration/unlock', '/api/products', '/api/migration/unlock/refresh']) {
    it(`refreshes and retries an authentication 401 for ${url}`, (): void => {
      let result: unknown;
      http.post(url, {}).subscribe((body: unknown): void => { result = body; });
      controller.expectOne(url).flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
      expect(refreshSession).toHaveBeenCalledTimes(1);
      const retry = controller.expectOne(url);
      expect(retry.request.withCredentials).toBeTrue();
      retry.flush({ success: true });
      expect(result).toEqual({ success: true });
    });
  }

  it('does not exempt a different endpoint reporting the same password message', (): void => {
    http.post('/api/migration/unlock/refresh', {}).subscribe();
    controller.expectOne('/api/migration/unlock/refresh').flush({ message: 'Contraseña incorrecta' }, { status: 401, statusText: 'Unauthorized' });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    controller.expectOne('/api/migration/unlock/refresh').flush({ success: true });
  });
  it('ends a revoked session when the retried request is still unauthorized during the refresh cooldown', (): void => {
    let received: unknown;
    http.get('/api/products').subscribe({ error: (error: unknown): void => { received = error; } });
    controller.expectOne('/api/products').flush({}, { status: 401, statusText: 'Unauthorized' });
    controller.expectOne('/api/products').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(endSession).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledOnceWith(['/auth/login']);
    expect(received instanceof HttpErrorResponse).toBeTrue();
  });

  it('does not log out on a server error from the retry', (): void => {
    http.get('/api/products').subscribe({ error: (): void => undefined });
    controller.expectOne('/api/products').flush({}, { status: 401, statusText: 'Unauthorized' });
    controller.expectOne('/api/products').flush({}, { status: 500, statusText: 'Server error' });
    expect(endSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

});
