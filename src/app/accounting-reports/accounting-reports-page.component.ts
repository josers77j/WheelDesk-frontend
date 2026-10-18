import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AccountingReportsService, ReportPeriod, ReportFormat } from './accounting-reports.service';
import { availableYears, availableMonths, MONTH_NAMES } from '../shared/utils/invoice-periods';
import { reportRangeError } from '../shared/utils/report-range';
import { AlertService } from '../shared/components/alert/alert.service';

@Component({
  selector: 'app-accounting-reports-page',
  imports: [FormsModule],
  templateUrl: './accounting-reports-page.component.html',
})
export class AccountingReportsPageComponent {
  private readonly service = inject(AccountingReportsService);
  private readonly alerts = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);
  readonly period = signal<ReportPeriod | null>(null);
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly monthNames = MONTH_NAMES;
  mode = 'month'; year = 0; month = 0; from = ''; to = '';
  formats: ReportFormat[] = [];
  toggleFormat(format: ReportFormat): void { if(this.busy())return;this.formats=this.formats.includes(format)?this.formats.filter(value=>value!==format):[...this.formats,format]; }
  get packageEntries(): string[] {
    const entries=this.formats.includes('excel')?['resumen.xlsx']:[];
    const prefix=this.formats.length>1?'facturas/':'';
    if(this.formats.includes('pdf'))entries.push(`${prefix}Facturas PDF del período`);
    if(this.formats.includes('json'))entries.push(`${prefix}Archivos JSON del período`);
    return entries;
  }
  constructor() { this.loadPeriod(); }
  loadPeriod(): void {
    if (this.loading()) return;
    this.loading.set(true); this.failed.set(false);
    this.service.period().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false))).subscribe({
      next: period => { this.period.set(period); const latest=period.periods.at(-1) ?? period.today.slice(0,7);this.year = Number(latest.slice(0,4)); this.month = Number(latest.slice(5,7)); this.selectMonth(); },
      error: () => { this.failed.set(true); this.alerts.showError('No se pudo consultar el período disponible. Intenta nuevamente.'); },
    });
  }
  get years(): number[] { return availableYears(this.period()?.periods ?? []); }
  get months(): number[] { return availableMonths(this.period()?.periods ?? [],this.year); }
  selectMonth(): void {
    if (!this.months.includes(this.month)) this.month=this.months[0] ?? 1;
    const prefix=`${this.year}-${String(this.month).padStart(2,'0')}`;
    this.from=`${prefix}-01`;
    const last=new Date(Date.UTC(this.year,this.month,0)).getUTCDate();
    this.to=`${prefix}-${last}`;
    const today=this.period()?.today; if(today && this.to>today) this.to=today;
  }
  download(): void {
    if(this.busy()) return;
    if (!this.period()?.firstDate) return;
    const invalid=!this.from || !this.to ? 'Selecciona ambas fechas.' : reportRangeError(this.from,this.to,31);
    if(invalid) { this.alerts.showWarning(invalid); return; }
    if(this.to > this.period()!.today) { this.alerts.showWarning('La fecha final no puede estar en el futuro.'); return; }
    if(!this.formats.length) { this.alerts.showWarning('Selecciona PDF, JSON o Excel.'); return; }
    this.busy.set(true);
    this.service.export(this.from,this.to,this.formats).pipe(takeUntilDestroyed(this.destroyRef),finalize(()=>this.busy.set(false))).subscribe({
      next: result => { const anchor=document.createElement('a'); anchor.href=result.url; anchor.download=result.filename; anchor.rel='noopener'; document.body.appendChild(anchor); anchor.click(); anchor.remove(); },
      error: (error: unknown) => {
        const body: unknown = error instanceof HttpErrorResponse ? error.error : null;
        const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : 'No se pudo preparar el reporte. Intenta un período menor o vuelve a intentarlo.';
        this.alerts.showError(message);
      },
    });
  }
}
