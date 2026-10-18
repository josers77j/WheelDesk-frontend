import { DashboardFooterComponent } from '../../components/dashboard-footer/dashboard-footer.component';
import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';

import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, firstValueFrom, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  SIDEBAR_GROUPS,
  SidebarMenuGroup,
} from '../../../shared/consts/sidebar-menu.const';
import { AuthService } from '../../../auth/services/auth.service';
import { ThemeService } from '../../../shared/services/theme.service';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { SidebarTooltipDirective } from './sidebar-tooltip.directive';
import packageInfo from '../../../../../package.json';

const OPEN_GROUPS_STORAGE_KEY = 'workshop.sidebar.openGroups';
const COLLAPSED_STORAGE_KEY = 'workshop.sidebar.collapsed';
const DESKTOP_BREAKPOINT = 1024;

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadOpenGroups(): string[] {
  try {
    const raw = localStorage.getItem(OPEN_GROUPS_STORAGE_KEY);
    if (!raw) return ['general'];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : ['general'];
  } catch {
    return ['general'];
  }
}

@Component({
  selector: 'app-dashboard-layout',
  imports: [DashboardFooterComponent, RouterOutlet, RouterLink, RouterLinkActive, AlertComponent, SidebarTooltipDirective],
  templateUrl: './dashboard-layout.component.html',
})
export default class DashboardLayoutComponent implements OnDestroy {
  router = inject(Router);
  authService = inject(AuthService);
  themeService = inject(ThemeService);

  /** Versión del front (package.json al compilar): una por deploy. */
  readonly appVersion = packageInfo.version;

  sidebarGroups = computed<SidebarMenuGroup[]>(() => {
    const reports: SidebarMenuGroup = { id: 'reports', label: 'Reportes', icon: 'icon-[tabler--file-spreadsheet]', items: [{ title: 'Reportes contables', path: 'accounting-reports', icon: 'icon-[tabler--file-spreadsheet]' }] };
    if (this.authService.user()?.role === 'ACCOUNTANT') return [...SIDEBAR_GROUPS.filter(group => group.id === 'general').map(group => ({ ...group, items: group.items.filter(item => item.path === '') })), reports];
    const groups = SIDEBAR_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => !item.adminOnly || this.authService.isAdmin()) })).filter((group) => group.items.length > 0);
    return this.authService.isAdmin() ? [...groups, reports] : groups;
  });

  /** Secciones expandidas (persistidas en localStorage). */
  openGroups = signal<string[]>(loadOpenGroups());

  /** Sidebar contraído a solo iconos (solo aplica en desktop). */
  sidebarCollapsed = signal<boolean>(loadCollapsed());

  /** En móvil/tablet el drawer siempre muestra los grupos. */
  isDesktop = signal(
    typeof window === 'undefined' ? true : window.innerWidth >= DESKTOP_BREAKPOINT,
  );

  private onResize = () => {
    this.isDesktop.set(window.innerWidth >= DESKTOP_BREAKPOINT);
  };

  constructor() {
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
  }

  /** Vista plana (iconos) cuando está contraído en desktop. */
  showFlat = computed(() => this.sidebarCollapsed() && this.isDesktop());

  toggleSidebar() {
    this.sidebarCollapsed.update((value) => !value);
  }

  /** Todos los items planos (atajo para badges/contadores si se necesitan). */
  flatItems = computed(() => this.sidebarGroups().flatMap((group) => group.items));

  currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Auto-expande el grupo de la ruta activa sin cerrar los demás. */
  autoExpandEffect = effect(() => {
    const url = this.currentUrl();
    const active = this.sidebarGroups().find((group) =>
      group.items.some(
        (item) =>
          item.path !== undefined &&
          (url === `/${item.path}` || url.startsWith(`/${item.path}/`)),
      ),
    );
    if (active && !this.openGroups().includes(active.id)) {
      this.openGroups.update((ids) => [...ids, active.id]);
    }
  });

  persistEffect = effect(() => {
    try {
      localStorage.setItem(
        OPEN_GROUPS_STORAGE_KEY,
        JSON.stringify(this.openGroups()),
      );
      localStorage.setItem(
        COLLAPSED_STORAGE_KEY,
        JSON.stringify(this.sidebarCollapsed()),
      );
    } catch {
      // almacenamiento no disponible: el estado vive solo en memoria
    }
  });

  isGroupOpen(id: string): boolean {
    return this.openGroups().includes(id);
  }

  toggleGroup(id: string) {
    this.openGroups.update((ids) =>
      ids.includes(id) ? ids.filter((open) => open !== id) : [...ids, id],
    );
  }

  closeDrawerIfMobile(drawer: HTMLInputElement) {
    if (window.innerWidth < 1024) {
      // lg breakpoint
      drawer.checked = false;
    }
  }

  closeAccountMenu(menu: HTMLElement): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement && menu.contains(active)) active.blur();
  }

  logout() {
    firstValueFrom(this.authService.logout())
      .catch((err: unknown) => console.warn('logout failed', err))
      .then(() => this.router.navigateByUrl('/auth/login'));
  }
}
