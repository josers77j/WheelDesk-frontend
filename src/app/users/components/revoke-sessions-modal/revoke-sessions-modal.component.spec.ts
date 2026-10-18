import { Router } from '@angular/router';
import type { User as AuthUser } from '../../../auth/interfaces/user.interface';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of, throwError } from 'rxjs';
import { RevokeSessionsModalComponent } from './revoke-sessions-modal.component';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../../auth/services/auth.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { RefreshToken, User, UserResponse } from '../../interfaces/user.interface';

describe('RevokeSessionsModalComponent cache updates', (): void => {
  let client: QueryClient;
  let users: jasmine.SpyObj<UserService>;
  const currentUser = signal<AuthUser | null>(null);
  let endSession: jasmine.Spy;
  let navigate: jasmine.Spy;

  function token(id: string, userId: number): RefreshToken {
    return { id, userId, tokenHash: 'qa', userAgent: 'qa', deviceType: 'desktop',
      ipAddress: '127.0.0.1', expiresAt: new Date(), isRevoked: false,
      createdAt: new Date(), updatedAt: new Date() };
  }

  function user(id: number, tokens: RefreshToken[]): User {
    return { id, name: 'QA', email: 'qa@example.com', role: 'VIEWER',
      createdAt: new Date(), refreshToken: tokens };
  }

  function response(data: User[]): UserResponse {
    return { data, meta: { page: 1, limit: 10, total: data.length, totalPages: 1,
      hasNextPage: false, hasPreviousPage: false } };
  }

  beforeEach(async (): Promise<void> => {
    currentUser.set(null);
    endSession = jasmine.createSpy('endSession').and.callFake((): void => currentUser.set(null));
    navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    users = jasmine.createSpyObj<UserService>('UserService', ['revokeSession']);
    users.revokeSession.and.returnValue(of(undefined));
    await TestBed.configureTestingModule({ imports: [RevokeSessionsModalComponent], providers: [
      provideTanStackQuery(client),
      { provide: UserService, useValue: users },
      { provide: AuthService, useValue: { user: currentUser, endSession } },
      { provide: Router, useValue: { navigate } },
      { provide: AlertService, useValue: jasmine.createSpyObj<AlertService>('AlertService', ['showSuccess', 'showError']) },
    ] }).compileComponents();
  });

  afterEach((): void => client.clear());

  function create(): ComponentFixture<RevokeSessionsModalComponent> {
    const fixture = TestBed.createComponent(RevokeSessionsModalComponent);
    fixture.componentRef.setInput('user', { name: 'QA', refreshToken: [token('revoked', 7), token('kept', 7)] });
    fixture.detectChanges();
    return fixture;
  }

  it('updates every filtered users page while preserving metadata and unrelated users', async (): Promise<void> => {
    const selected = user(7, [token('revoked', 7), token('kept', 7)]);
    const other = user(8, [token('other', 8)]);
    const first = response([selected, other]);
    const second = response([selected]);
    client.setQueryData(['users', 10, 1, ''], first);
    client.setQueryData(['users', 10, 2, 'QA'], second);
    client.setQueryData(['user', 7], selected);
    const fixture = create();
    await fixture.componentInstance.revokeSession.mutateAsync('revoked');
    const updated = client.getQueryData<UserResponse>(['users', 10, 1, '']);
    expect(updated?.meta).toEqual(first.meta);
    expect(updated?.data[0].refreshToken.map(t => t.id)).toEqual(['kept']);
    expect(updated?.data[1]).toEqual(other);
    expect(client.getQueryData<UserResponse>(['users', 10, 2, 'QA'])?.data[0].refreshToken.map(t => t.id)).toEqual(['kept']);
    expect(client.getQueryData(['user', 7])).toEqual(selected);
    expect(fixture.componentInstance.tokens().map(t => t.id)).toEqual(['kept']);
    expect(users.revokeSession).toHaveBeenCalledOnceWith('revoked');
  });

  it('does not create a cache entry when no users page is loaded', async (): Promise<void> => {
    const fixture = create();
    await fixture.componentInstance.revokeSession.mutateAsync('revoked');
    expect(client.getQueriesData({ queryKey: ['users'] })).toEqual([]);
    expect(fixture.componentInstance.tokens().map(t => t.id)).toEqual(['kept']);
  });
  it('ends the local session and navigates to login when revoking this browser session', async (): Promise<void> => {
    currentUser.set({ id: 7, name: 'QA', email: 'qa@example.test', role: 'ADMIN', sessionId: 'revoked' });
    const fixture = create();
    await fixture.componentInstance.revokeSession.mutateAsync('revoked');
    expect(endSession).toHaveBeenCalledTimes(1);
    expect(currentUser()).toBeNull();
    expect(navigate).toHaveBeenCalledOnceWith(['/auth/login']);
    expect(users.revokeSession).toHaveBeenCalledOnceWith('revoked');
  });

  it('keeps this browser signed in when another session is revoked', async (): Promise<void> => {
    currentUser.set({ id: 7, name: 'QA', email: 'qa@example.test', role: 'ADMIN', sessionId: 'kept' });
    const fixture = create();
    await fixture.componentInstance.revokeSession.mutateAsync('revoked');
    expect(endSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(currentUser()?.sessionId).toBe('kept');
  });

  it('does not end the current session when revocation fails', async (): Promise<void> => {
    currentUser.set({ id: 7, name: 'QA', email: 'qa@example.test', role: 'ADMIN', sessionId: 'revoked' });
    users.revokeSession.and.returnValue(throwError(() => new Error('Temporary failure')));
    const fixture = create();
    await expectAsync(fixture.componentInstance.revokeSession.mutateAsync('revoked')).toBeRejected();
    expect(endSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.tokens().length).toBe(2);
  });

});
