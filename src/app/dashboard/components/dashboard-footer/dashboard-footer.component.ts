import { APP_BRANDING } from '../../../shared/consts/branding.const';
import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard-footer',
  template: `<footer class="footer bg-base-100 border-t border-base-content/15 px-4 py-5 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-base-content/60">
    <span>© {{ year }} {{ appName }}</span>
    <span class="inline-flex items-center gap-1">made with <span class="icon-[tabler--heart-filled] text-error text-sm" role="img" aria-label="amor"></span> by josers77j</span>
  </footer>`,
})
export class DashboardFooterComponent {
  readonly appName = APP_BRANDING.name;
  readonly year = new Date().getFullYear();
}
