import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { USER_ROLES } from '../../interfaces/user.interface';
import { TestBed } from '@angular/core/testing';
import {
  provideTanStackQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { UserFormModalComponent } from './user-form-modal.component';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../../auth/services/auth.service';
import { AlertService } from '../../../shared/components/alert/alert.service';

describe('safe user form defaults', (): void => {
  it('defaults and resets new accounts to VIEWER instead of ADMIN', (): void => {
    TestBed.configureTestingModule({
      imports: [UserFormModalComponent],
      providers: [
        provideTanStackQuery(new QueryClient()),
        { provide: UserService, useValue: {} },
        { provide: AuthService, useValue: { user: (): null => null } },
        { provide: AlertService, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(UserFormModalComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.userForm.controls.role.value).toBe(
      'VIEWER',
    );
    fixture.componentInstance.userForm.controls.role.setValue('ADMIN');
    fixture.componentInstance.openForCreate();
    expect(fixture.componentInstance.userForm.controls.role.value).toBe(
      'VIEWER',
    );
    fixture.componentInstance.closeModal();
  });
});

describe('New user role HTTP payload', (): void => {
  let client: QueryClient;
  let http: HttpTestingController;
  let fixture: ComponentFixture<UserFormModalComponent>;
  beforeEach((): void => {
    client = new QueryClient();
    TestBed.configureTestingModule({
      imports: [UserFormModalComponent],
      providers: [provideTanStackQuery(client), provideHttpClient(), provideHttpClientTesting(), UserService,
        { provide: AuthService, useValue: { user: (): null => null } },
        { provide: AlertService, useValue: { showSuccess: jasmine.createSpy('success'), showError: jasmine.createSpy('error') } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UserFormModalComponent);
    fixture.detectChanges();
  });
  afterEach((): void => { http.verify(); client.clear(); });
  for (const role of USER_ROLES) {
    it(`sends the selected ${role} through the real form and user service`, async (): Promise<void> => {
      fixture.componentInstance.openForCreate();
      fixture.detectChanges();
      const host: unknown = fixture.nativeElement;
      if (!(host instanceof HTMLElement)) throw new Error('Expected user modal host');
      for (const [field, value] of [['name', 'QA usuario'], ['email', 'qa@example.test']]) {
        const input = host.querySelector<HTMLInputElement>(`input[formControlName="${field}"]`);
        if (!input) throw new Error('Expected user input');
        input.value = value;
        input.dispatchEvent(new Event('input'));
      }
      const select = host.querySelector<HTMLSelectElement>('select[formControlName="role"]');
      if (!select) throw new Error('Expected role selector');
      select.value = role;
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(fixture.componentInstance.userForm.controls.role.value).toBe(role);
      const form = host.querySelector('form');
      if (!form) throw new Error('Expected user form');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      const request = http.expectOne(req => req.method === 'POST' && req.url.endsWith('/users'));
      expect(request.request.body).toEqual({ name: 'QA usuario', email: 'qa@example.test', role });
      request.flush({ id: 7, name: 'QA usuario', email: 'qa@example.test', role, createdAt: '2026-10-17', refreshToken: [] });
      await fixture.whenStable();
    });
  }
});
