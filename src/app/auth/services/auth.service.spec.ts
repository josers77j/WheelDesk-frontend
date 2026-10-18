import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { AuthService, AUTH_STATUS } from './auth.service';

describe('Best-effort logout completion', () => {
  let service: AuthService; let http: HttpTestingController; let clear: jasmine.Spy;
  beforeEach(() => {
    clear = jasmine.createSpy('clear');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: QueryClient, useValue: { clear } }] });
    service = TestBed.inject(AuthService); http = TestBed.inject(HttpTestingController);
    service.login('qa@example.test', 'test-password').subscribe();
    http.expectOne(req => req.url.endsWith('/auth/login')).flush({ payload: { id: 1, email: 'qa@example.test', name: 'QA', role: 'ADMIN' } });
  });
  afterEach(() => http.verify({ ignoreCancelled: true }));
  it('cancels an unanswered request after ten seconds and clears the local session once', fakeAsync(() => {
    let completed = false; service.logout().subscribe(() => { completed = true; });
    const request = http.expectOne(req => req.url.endsWith('/auth/logout'));
    tick(9999); expect(completed).toBeFalse(); tick(1);
    expect(request.cancelled).toBeTrue(); expect(completed).toBeTrue();
    expect(service.user()).toBeNull(); expect(service.authStatus()).toBe(AUTH_STATUS.NOT_AUTHENTICATED); expect(clear).toHaveBeenCalledTimes(1);
    http.expectNone(req => req.url.endsWith('/auth/logout'));
  }));
  for (const failure of [false, true]) {
    it(`clears the local session on ${failure ? 'server error' : 'success'}`, () => {
      let result: boolean | undefined; service.logout().subscribe(value => { result = value; });
      const request = http.expectOne(req => req.url.endsWith('/auth/logout'));
      if (failure) request.flush({}, { status: 500, statusText: 'Error' }); else request.flush({});
      expect(result).toBeTrue(); expect(service.user()).toBeNull(); expect(clear).toHaveBeenCalledTimes(1);
    });
  }
  for (const operation of ['profile', 'refresh-session']) {
    it(`does not restore identity from a delayed ${operation} response after logout`, () => {
      service.invalidateProfileCache();
      let accepted: boolean | undefined;
      if (operation === 'profile') service.checkProfile().subscribe(value => { accepted = value; });
      else service.refreshSession().subscribe(value => { accepted = value; });
      const pending = http.expectOne(req => req.url.endsWith('/auth/' + operation));
      service.logout().subscribe();
      http.expectOne(req => req.url.endsWith('/auth/logout')).flush({});
      pending.flush({ payload: { id: 1, name: 'QA', email: 'qa@example.test', role: 'ADMIN' } });
      expect(accepted).toBeFalse();
      expect(service.user()).toBeNull();
      expect(service.authStatus()).toBe(AUTH_STATUS.NOT_AUTHENTICATED);
    });
  }

  it('clears a revoked session synchronously without another HTTP request', () => {
    service.endSession();
    expect(service.user()).toBeNull();
    expect(service.authStatus()).toBe(AUTH_STATUS.NOT_AUTHENTICATED);
    expect(clear).toHaveBeenCalledTimes(1);
    service.checkProfile().subscribe(value => expect(value).toBeFalse());
    service.refreshSession().subscribe(value => expect(value).toBeFalse());
    http.expectNone(req => req.url.includes('/auth/'));
  });

  it('ignores an old profile failure after signing in again', () => {
    service.invalidateProfileCache();
    service.checkProfile().subscribe();
    const oldProfile = http.expectOne(req => req.url.endsWith('/auth/profile'));
    service.logout().subscribe();
    http.expectOne(req => req.url.endsWith('/auth/logout')).flush({});
    service.login('new@example.test', 'test-password').subscribe();
    http.expectOne(req => req.url.endsWith('/auth/login')).flush({ payload: { id: 2, name: 'New user', email: 'new@example.test', role: 'ADMIN' } });
    oldProfile.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(service.user()?.id).toBe(2);
    expect(service.authStatus()).toBe(AUTH_STATUS.AUTHENTICATED);
    http.expectNone(req => req.url.endsWith('/auth/refresh-session'));
  });

});
