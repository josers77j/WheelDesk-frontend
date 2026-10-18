import { APP_BRANDING } from '../consts/branding.const';
import { Injectable, computed, signal } from '@angular/core';

export type AppTheme = 'corporate' | 'sunset';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly storageKey = 'app_theme';

  theme = signal<AppTheme>(this.getInitialTheme());
  isDarkMode = computed(() => this.theme() === 'sunset');

  readonly appName = APP_BRANDING.name;
  readonly logo = computed(() =>
    this.isDarkMode() ? APP_BRANDING.darkLogoUrl : APP_BRANDING.lightLogoUrl,
  );

  constructor() {
    this.applyTheme(this.theme());
  }

  private getInitialTheme(): AppTheme {
    try {
      const savedTheme = localStorage.getItem(
        this.storageKey,
      ) as AppTheme | null;
      if (savedTheme === 'corporate' || savedTheme === 'sunset') {
        return savedTheme;
      }

      // Check system preference
      if (
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: sunset)').matches
      ) {
        return 'sunset';
      }
    } catch {
      // Ignore localStorage access errors (e.g. incognito)
    }

    return 'corporate';
  }

  toggleTheme(): void {
    const nextTheme: AppTheme =
      this.theme() === 'sunset' ? 'corporate' : 'sunset';
    this.setTheme(nextTheme);
  }

  setTheme(theme: AppTheme): void {
    this.applyTheme(theme);
    this.theme.set(theme);

    try {
      localStorage.setItem(this.storageKey, theme);
    } catch {
      // Ignore
    }
  }

  private applyTheme(theme: AppTheme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }
}
