import { ElementRef, viewChild } from '@angular/core';
import { QuotationPreviewComponent } from '../../components/quotation-preview/quotation-preview.component';
import { FilterPanelComponent } from '../../../shared/components/filter-panel/filter-panel.component';
import { listSelectionNumber } from '../../../shared/utils/list-selection';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { TitleComponent } from '../../../shared/components/title/title.component';
import { LimitComponent } from '../../../shared/components/limit/limit.component';
import { DateRangeComponent } from '../../../shared/components/date-range/date-range.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { QueryErrorComponent } from '../../../shared/components/query-error/query-error.component';
import { ComboboxFormControlComponent } from '../../../shared/components/combobox-form-control/combobox-form-control.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { ValueParams } from '../../../shared/components/combobox/interfaces/search-param.interface';
import { QuotationService } from '../../services/quotation.service';
import { QuotationTableComponent } from '../../components/quotation-table/quotation-table.component';
import { QuotationDocumentActionsComponent } from '../../components/quotation-document-actions/quotation-document-actions.component';
@Component({ selector: 'app-quotations-page', imports: [
    QuotationPreviewComponent, FilterPanelComponent,RouterLink, ReactiveFormsModule, PaginationComponent, TitleComponent, LimitComponent, DateRangeComponent, SkeletonComponent, QueryErrorComponent, ComboboxFormControlComponent, AlertComponent, QuotationTableComponent, QuotationDocumentActionsComponent], templateUrl: './quotations-page.component.html' })
export class QuotationsPageComponent {
 private readonly route = inject(ActivatedRoute); private readonly router = inject(Router); private readonly service = inject(QuotationService); private readonly customers = inject(CustomerService); private readonly alerts = inject(AlertService);
 private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
 readonly isOpen = signal(false); readonly selectedId = signal(0); readonly customerSearch = signal(''); readonly customerTouched = signal(false); readonly selectedCustomer = signal<ValueParams | null>(null);
 readonly filtersForm = inject(FormBuilder).nonNullable.group({ documentNumber: '', from: '', to: '' });
 readonly page = computed((): number => { const value = Number(this.params().get('page') ?? 1); return Number.isSafeInteger(value) && value > 0 ? value : 1; });
 readonly limit = computed((): number => { const value = Number(this.params().get('limit') ?? 10); return [10,20,50,100].includes(value) ? value : 10; });
 readonly applied = computed(() => ({ documentNumber: this.params().get('documentNumber') ?? '', customerId: Number(this.params().get('customerId')) || undefined, from: this.params().get('from') ?? '', to: this.params().get('to') ?? '' }));
 readonly syncFilters = effect(() => { const filters = this.applied(); this.page(); this.limit(); this.filtersForm.patchValue({ documentNumber: filters.documentNumber, from: filters.from, to: filters.to }); const previous = untracked(this.selectedCustomer); this.selectedCustomer.set(filters.customerId ? { id: filters.customerId, name: previous?.id === filters.customerId ? previous.name : `Cliente #${filters.customerId}` } : null); this.selectedId.set(0); });
 readonly customerQuery = injectQuery(() => ({ queryKey: ['quotation-filter-customers', this.customerSearch()], queryFn: () => firstValueFrom(this.customers.getCustomers(1, 10, this.customerSearch())), enabled: this.customerTouched() && this.isOpen(), staleTime: 300000 }));
 readonly customerOptions = computed(() => (this.customerQuery.data()?.data ?? []).map((c): ValueParams => ({ id: c.id, name: c.name })));
 readonly quotations = injectQuery(() => ({ queryKey: ['quotations', this.page(), this.limit(), this.applied()], queryFn: () => firstValueFrom(this.service.getQuotations(this.page(), this.applied().documentNumber, this.limit(), this.applied())), staleTime: 300000 }));
 search(): void { if (this.quotations.isFetching()) return; const filters = this.filtersForm.getRawValue(); filters.documentNumber = filters.documentNumber.trim(); if (filters.from && filters.to && filters.from > filters.to) { this.alerts.showError('La fecha inicial no puede ser posterior a la final'); return; } this.navigate({ ...filters, customerId: this.selectedCustomer()?.id ?? null }); }
 reset(): void { if (this.quotations.isFetching()) return; this.selectedCustomer.set(null); this.filtersForm.reset(); this.navigate({ documentNumber: null, customerId: null, from: null, to: null }); }
 changeLimit(limit: number): void { this.navigate({ limit }); }
 chooseCustomer(value: ValueParams | null): void { this.selectedCustomer.set(value); }
 private navigate(filters: Record<string, string | number | null>): void { void this.router.navigate([], { relativeTo: this.route, queryParams: { ...filters, page: 1 }, queryParamsHandling: 'merge' }); }
 readonly previewId = signal<number | null>(null);
 readonly previewDialog = viewChild<ElementRef<HTMLDialogElement>>('previewDialog');
 readonly preview = injectQuery(() => ({ queryKey: ['quotation', this.previewId()], queryFn: () => firstValueFrom(this.service.getQuotation(this.previewId() ?? 0)), enabled: this.previewId() !== null, staleTime: 300000 }));
 openPreview(): void { this.previewId.set(this.selectedId()); this.previewDialog()?.nativeElement.showModal(); }
 closePreview(): void { this.previewDialog()?.nativeElement.close(); this.previewId.set(null); }
 readonly selectedRowNumber = listSelectionNumber(this.selectedId, this.page, () => this.quotations.data());
}
