import { RouterLink } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { DashboardService } from '../../services/dashboard.service';
import { availableYears, availableMonths, monthRange, MONTH_NAMES } from '../../../shared/utils/invoice-periods';
import type { DashboardSalesPoint } from '../../models/dashboard.model';

@Component({
  selector: 'app-dashboard-page',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './dashboard-page.component.html',
})
export class DashboardPageComponent {
  readonly authService = inject(AuthService);
  readonly canAccessReports = computed(() => this.authService.isAdmin() || this.authService.user()?.role === 'ACCOUNTANT');
  private readonly dashboardService = inject(DashboardService);
  readonly monthNames = MONTH_NAMES;
  readonly selectedPeriod = signal('');
  readonly selectedDay = signal<DashboardSalesPoint | null>(null);
  readonly periodQuery = injectQuery(() => ({queryKey:['dashboard','period'], enabled:this.authService.isAdmin(), queryFn:()=>firstValueFrom(this.dashboardService.getPeriod()),staleTime:30_000}));
  readonly years = computed(()=>availableYears(this.periodQuery.data()?.periods ?? []));
  readonly year = computed(()=>Number(this.selectedPeriod().slice(0,4)));
  readonly month = computed(()=>Number(this.selectedPeriod().slice(5,7)));
  readonly months = computed(()=>availableMonths(this.periodQuery.data()?.periods ?? [],this.year()));
  readonly range = computed(()=>monthRange(this.selectedPeriod() || '2000-01',this.periodQuery.data()?.today ?? '2000-01-01'));
  readonly summaryQuery = injectQuery(()=>({
    queryKey:['dashboard','summary',this.selectedPeriod()],enabled:this.authService.isAdmin() && !!this.selectedPeriod(),
    queryFn:()=>firstValueFrom(this.dashboardService.getSummary(this.range().from,this.range().to)),
  }));
  readonly summary = computed(()=>this.summaryQuery.data());
  readonly maxDayTotal = computed(()=>Math.max(1,...(this.summary()?.salesByDay.map(day=>day.total) ?? [])));
  readonly incomeDelta = computed(()=>{const kpis=this.summary()?.kpis;return kpis?.prevIncome?((kpis.income-kpis.prevIncome)/kpis.prevIncome)*100:null;});
  constructor() {
    effect(()=>{const periods=this.periodQuery.data()?.periods ?? [];if(!periods.includes(this.selectedPeriod()))this.selectedPeriod.set(periods.at(-1) ?? '');});
  }
  setYear(year: number): void {
    const periods=(this.periodQuery.data()?.periods ?? []).filter(period=>period.startsWith(`${year}-`));
    this.choosePeriod(periods.find(period=>Number(period.slice(5))===this.month()) ?? periods.at(-1) ?? '');
  }
  setMonth(month: number): void { this.choosePeriod(`${this.year()}-${String(month).padStart(2,'0')}`); }
  private choosePeriod(period: string): void {
    if(!(this.periodQuery.data()?.periods ?? []).includes(period))return;
    this.selectedDay.set(null);this.selectedPeriod.set(period);
  }
}
