import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { TitleComponent } from '../../../shared/components/title/title.component';
import { UserFormModalComponent } from '../../components/user-form-modal/user-form-modal.component';
import { UserService } from '../../services/user.service';
import type { UserResponse } from '../../interfaces/user.interface';
import { UsersPageComponent } from './users-page.component';

describe('Users creation entry point', (): void => {
  const role = signal('ADMIN');
  let client: QueryClient;
  beforeEach((): void => {
    role.set('ADMIN');
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const result: UserResponse = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } };
    client.setQueryData(['users', 10, 1, ''], result);
    const params = convertToParamMap({});
    TestBed.configureTestingModule({
      imports: [UsersPageComponent],
      providers: [provideRouter([]), provideTanStackQuery(client),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: params }, queryParamMap: of(params) } },
        { provide: UserService, useValue: { userIdSelected: signal(0), getUsers: (): ReturnType<UserService['getUsers']> => of(result) } },
        { provide: AuthService, useValue: { user: (): null => null, isAdmin: (): boolean => role() === 'ADMIN' } },
      ],
    }).overrideComponent(UsersPageComponent, { set: { imports: [TitleComponent, UserFormModalComponent], schemas: [NO_ERRORS_SCHEMA] } });
  });
  afterEach((): void => client.clear());
  it('exposes an admin create button that opens a fresh new-user form', (): void => {
    const fixture = TestBed.createComponent(UsersPageComponent);
    fixture.detectChanges();
    const button = fixture.debugElement.queryAll(By.css('app-title button')).find(element => { const node: unknown = element.nativeElement; return node instanceof HTMLButtonElement && node.textContent?.includes('Crear usuario'); });
    expect(button).toBeDefined();
    if (!button) throw new Error('Missing create user button');
    button.triggerEventHandler('click');
    fixture.detectChanges();
    const modal: unknown = fixture.debugElement.query(By.directive(UserFormModalComponent)).componentInstance;
    if (!(modal instanceof UserFormModalComponent)) throw new Error('Expected user form');
    expect(modal.isEditing()).toBeFalse();
    expect(modal.userForm.getRawValue()).toEqual({ name: '', email: '', role: 'VIEWER' });
    const host: unknown = fixture.nativeElement;
    if (!(host instanceof HTMLElement)) throw new Error('Expected users page');
    const dialog = host.querySelector('#user_modal');
    if (!(dialog instanceof HTMLDialogElement)) throw new Error('Expected user dialog');
    expect(dialog.open).toBeTrue();
    dialog.close();
  });
  for (const restricted of ['SELLER', 'VIEWER', 'ACCOUNTANT']) {
    it(`does not offer user creation to ${restricted}`, (): void => {
      role.set(restricted);
      const fixture = TestBed.createComponent(UsersPageComponent);
      fixture.detectChanges();
      expect(fixture.debugElement.queryAll(By.css('app-title button'))).toEqual([]);
    });
  }
});
