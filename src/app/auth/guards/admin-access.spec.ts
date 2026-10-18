import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { routes } from '../../app.routes';
import { AlertService } from '../../shared/components/alert/alert.service';
import { User } from '../interfaces/user.interface';
import { AuthService } from '../services/auth.service';

@Component({ selector: 'app-test-admin-shell', imports: [RouterOutlet], template: '<router-outlet />' })
class ShellComponent {}

@Component({ selector: 'app-test-admin-module', template: 'Module content' })
class ModuleComponent {}

function testRoutes(): Routes {
  const dashboard = routes[0]?.children?.find((route) => route.path === '');
  if (!dashboard?.children) throw new Error('Dashboard routes are missing');
  return [
    { path: 'auth/login', component: ModuleComponent },
    {
      ...dashboard,
      component: ShellComponent,
      children: dashboard.children.map((route) => ({
        ...route,
        loadChildren: async (): Promise<Routes> => route.path === ''
          ? [{ path: '', pathMatch: 'full', component: ModuleComponent }]
          : [{ path: '**', component: ModuleComponent }],
      })),
    },
  ];
}

describe('Administrative route access', (): void => {
  const user = signal<User | null>(null);
  let authenticated: boolean;
  let alert: jasmine.Spy;
  const sections = ['users', 'audit', 'migration', 'company'];

  function setRole(role?: User['role']): void {
    user.set({ id: 1, name: 'QA', email: 'qa@example.test', role });
  }

  beforeEach((): void => {
    authenticated = true;
    setRole('VIEWER');
    alert = jasmine.createSpy('showError');
    TestBed.configureTestingModule({ providers: [
      provideRouter(testRoutes()),
      { provide: AuthService, useValue: {
        user,
        isAdmin: (): boolean => user()?.role === 'ADMIN',
        checkProfile: (): Observable<boolean> => of(authenticated),
      } },
      { provide: AlertService, useValue: { showError: alert } },
    ] });
  });

  for (const role of ['SELLER', 'VIEWER'] as const) {
    for (const section of sections) {
      it(`denies direct ${section} navigation for ${role}`, async (): Promise<void> => {
        setRole(role);
        const harness = await RouterTestingHarness.create('/');
        await harness.navigateByUrl(`/${section}/list`);
        expect(TestBed.inject(Router).url).toBe('/');
        expect(alert).toHaveBeenCalledTimes(1);
      });
    }
  }

  for (const section of sections) {
    it(`allows ${section} navigation for ADMIN`, async (): Promise<void> => {
      setRole('ADMIN');
      const harness = await RouterTestingHarness.create('/');
      await harness.navigateByUrl(`/${section}/list`);
      expect(TestBed.inject(Router).url).toBe(`/${section}/list`);
      expect(alert).not.toHaveBeenCalled();
    });
  }

  it('denies an authenticated profile without a role', async (): Promise<void> => {
    setRole();
    const harness = await RouterTestingHarness.create('/');
    await harness.navigateByUrl('/users/list');
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('rechecks access when navigating within an already loaded module', async (): Promise<void> => {
    setRole('ADMIN');
    const harness = await RouterTestingHarness.create('/users/list');
    setRole('VIEWER');
    await harness.navigateByUrl('/users/detail/1');
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('redirects an unauthenticated session to login', async (): Promise<void> => {
    authenticated = false;
    user.set(null);
    await RouterTestingHarness.create('/users/list');
    expect(TestBed.inject(Router).url).toBe('/auth/login');
  });
});
