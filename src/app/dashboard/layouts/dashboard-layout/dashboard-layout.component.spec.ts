import { Subject } from 'rxjs';
import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterLink } from '@angular/router';
import { By } from '@angular/platform-browser';
import { AuthService } from '../../../auth/services/auth.service';
import { User } from '../../../auth/interfaces/user.interface';
import { ThemeService } from '../../../shared/services/theme.service';
import DashboardLayoutComponent from './dashboard-layout.component';

describe('Administrative navigation visibility', (): void => {
  let fixture: ComponentFixture<DashboardLayoutComponent>;
  const user = signal<User | null>(null);

  function setRole(role: User['role']): void {
    user.set({ id: 1, name: 'QA', email: 'qa@example.test', role });
  }

  function navigationLinks(): string[] {
    const router = TestBed.inject(Router);
    return fixture.debugElement.queryAll(By.directive(RouterLink)).map((element): string => {
      const url = element.injector.get(RouterLink).urlTree;
      return url ? router.serializeUrl(url) : '';
    });
  }

  beforeEach((): void => {
    setRole('VIEWER');
    TestBed.configureTestingModule({ imports: [DashboardLayoutComponent], providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { user, isAdmin: computed(() => user()?.role === 'ADMIN') } },
      { provide: ThemeService, useValue: { appName: 'Tire Workshop', logo: (): string => '', isDarkMode: (): boolean => false } },
    ] });
    fixture = TestBed.createComponent(DashboardLayoutComponent);
    fixture.componentInstance.sidebarCollapsed.set(false);
    fixture.componentInstance.isDesktop.set(true);
  });

  for (const role of ['SELLER', 'VIEWER'] as const) {
    it(`hides admin links in expanded and collapsed menus for ${role}`, (): void => {
      setRole(role);
      for (const collapsed of [false, true]) {
        fixture.componentInstance.sidebarCollapsed.set(collapsed);
        fixture.detectChanges();
        const links = navigationLinks();
        expect(links.some((link) => /users|audit|migration|company/.test(link))).toBeFalse();
        expect(links.some((link) => link.includes('products'))).toBeTrue();
      }
    });
  }

  it('shows home and accounting reports for ACCOUNTANT', (): void => {
    setRole('ACCOUNTANT'); fixture.detectChanges();
    expect(fixture.componentInstance.flatItems().map(item => item.path)).toEqual(['', 'accounting-reports']);
  });

  it('links the configured business name to the dashboard when no logo is installed', (): void => {
    fixture.detectChanges();
    const logo = fixture.debugElement.query(By.css('a[aria-label="Ir al panel de control"]'));
    expect(logo).not.toBeNull();
    expect(logo.query(By.css('img'))).toBeNull();
    expect(logo.nativeElement.textContent).toContain('Tire Workshop');
    const tree = logo.injector.get(RouterLink).urlTree;
    expect(tree ? TestBed.inject(Router).serializeUrl(tree) : '').toBe('/');
  });

  it('keeps administrative navigation available for ADMIN', (): void => {
    setRole('ADMIN');
    fixture.detectChanges();
    const links = navigationLinks();
    for (const section of ['users', 'audit', 'migration', 'company']) {
      expect(links.some((link) => link.includes(section))).toBeTrue();
    }
  });

  it('removes administrative navigation when the current profile changes role', (): void => {
    setRole('ADMIN');
    fixture.detectChanges();
    setRole('VIEWER');
    fixture.detectChanges();
    expect(navigationLinks().some((link) => /users|audit|migration|company/.test(link))).toBeFalse();
  });
  it('waits for logout completion before navigating to login', async (): Promise<void> => {
    const result = new Subject<boolean>();
    const auth = TestBed.inject(AuthService);
    Object.assign(auth, { logout: (): Subject<boolean> => result });
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture.componentInstance.logout();
    expect(navigate).not.toHaveBeenCalled();
    result.next(true);
    result.complete();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledOnceWith('/auth/login');
  });

  it('releases dropdown focus when company settings is selected', (): void => {
    setRole('ADMIN');
    fixture.detectChanges();
    const menu = fixture.debugElement.query(By.css('.dropdown'));
    const container: unknown = menu.nativeElement;
    if (!(container instanceof HTMLElement)) throw new Error('Dropdown missing');
    const trigger = container.querySelector<HTMLElement>('[role="button"]');
    if (!trigger) throw new Error('Dropdown trigger missing');
    trigger.focus();
    const blur = spyOn(trigger, 'blur').and.callThrough();
    fixture.componentInstance.closeAccountMenu(container);
    expect(blur).toHaveBeenCalledTimes(1);
  });

});
