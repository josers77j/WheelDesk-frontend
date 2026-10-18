import { FilterPanelComponent } from '../../../shared/components/filter-panel/filter-panel.component';
import { PdfPreviewComponent } from '../../../shared/components/pdf-preview/pdf-preview.component';
import { listSelectionNumber } from '../../../shared/utils/list-selection';
import { SaleEmailActionsComponent } from '../../components/sale-email-actions/sale-email-actions.component';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { SaleOrderTableComponent } from '../../components/sale-order-table/sale-order-table.component';
import { SaleOrderService } from '../../services/sale-order.service';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { QueryClient, injectQuery } from '@tanstack/angular-query-experimental';
import { firstValueFrom, tap, timeout as requestTimeout } from 'rxjs';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { QueryErrorComponent } from '../../../shared/components/query-error/query-error.component';
import { LimitComponent } from '../../../shared/components/limit/limit.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { PaginationService } from '../../../shared/components/pagination/pagination.service';
import { DateRangeComponent } from '../../../shared/components/date-range/date-range.component';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { sameSearchParams } from '../../../shared/utils/search-params-compare.util';

import {
  saleOrderStatusList,
} from '../../enums/sale-order-status.enum';
import type { SaleOrderSearchParams } from '../../interfaces/sale-order.interface';
import { SaleOrderQuickViewComponent } from '../../components/quick-view/quick-view.component';
import { SaleActivityModalComponent } from '../../components/sale-activity-modal/sale-activity-modal.component';
import { AuthService } from '../../../auth/services/auth.service';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const toISO = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  return {
    from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toISO(now),
  };
}

@Component({
  selector: 'app-sale-orders-page',
  imports: [
    FilterPanelComponent,
    SaleOrderTableComponent,
    SaleEmailActionsComponent,
    PdfPreviewComponent,
    PaginationComponent,
    AlertComponent,
    LimitComponent,
    QueryErrorComponent,
    DateRangeComponent,
    SaleOrderQuickViewComponent,
    SaleActivityModalComponent,
    SkeletonComponent,
    RouterLink,
  ],
  templateUrl: './sale-orders-page.component.html',
})
export class SaleOrdersPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private destroyed = false;

  constructor() {
    this.destroyRef.onDestroy(() => { this.destroyed = true; this.jsonPreviewAbort?.abort(); });
  }
  readonly emailActions = viewChild(SaleEmailActionsComponent);
  readonly activityModal = viewChild(SaleActivityModalComponent);

  route = inject(Router);
  activatedRoute = inject(ActivatedRoute);
  queryClient = inject(QueryClient);

  saleOrderService = inject(SaleOrderService);
  paginationService = inject(PaginationService);
  alertService = inject(AlertService);
  readonly authService = inject(AuthService);
  readonly canCreateSale = computed(() => this.authService.isAdmin() || this.authService.user()?.role === 'SELLER');

  isOpen = signal<boolean>(false);
  openToggle() {
    this.isOpen.update((value) => !value);
  }

  limitPerPage = signal<number>(10);
  limitList = signal<number[]>([10, 20, 50, 100]);

  queryParamsSignal = toSignal(this.activatedRoute.queryParamMap, {
    initialValue: this.activatedRoute.snapshot.queryParamMap,
  });

  urlSearchParams = computed<SaleOrderSearchParams>(() => {
    const map = this.queryParamsSignal();
    const defaultRange =
      map.get('from') === null && map.get('to') === null
        ? currentMonthRange()
        : { from: map.get('from') ?? '', to: map.get('to') ?? '' };

    return {
      from: defaultRange.from,
      to: defaultRange.to,
      search: map.get('search') ?? '',
      minTotal: map.get('minTotal') ?? '',
      maxTotal: map.get('maxTotal') ?? '',
      status: map.get('status') ?? '',
      dteType: map.get('dteType') ?? '',
    };
  });

  formSearchParams = signal<SaleOrderSearchParams>({
    from: '',
    to: '',
    search: '',
    minTotal: '',
    maxTotal: '',
    status: '',
    dteType: '',
  });

  sincronyzedUrlSearchParams = effect(() => {
    const params = this.urlSearchParams();
    this.formSearchParams.set(params);
    this.appliedSearchParams.set(params);
  });

  appliedSearchParams = signal<SaleOrderSearchParams>(this.formSearchParams());

  /**
   * Auto-busca 1000ms después de dejar de escribir. Solo dispara si el texto
   * difiere de lo aplicado (cero peticiones redundantes) y el nonce cancela
   * el pendiente si se acciona Buscar manualmente.
   */
  private searchNonce = signal(0);

  filterDebounceEffect = effect((onCleanup) => {
    this.searchNonce();
    if (
      sameSearchParams(this.formSearchParams(), this.appliedSearchParams(), [
        'from',
        'to',
        'search',
        'minTotal',
        'maxTotal',
        'status',
        'dteType',
      ])
    )
      return;
    const timeout = setTimeout(() => this.onSearch(), 1000);
    onCleanup(() => clearTimeout(timeout));
  });

  onResetFilters(): void {
    if (this.saleOrderQuery.isFetching()) return;
    this.formSearchParams.set({
      from: '',
      to: '',
      search: '',
      minTotal: '',
      maxTotal: '',
      status: '',
      dteType: '',
    });
    this.onSearch();
  }

  saleOrderQuery = injectQuery(() => ({
    queryKey: [
      'sale-orders',
      this.limitPerPage(),
      this.paginationService.currentPage(),
      this.appliedSearchParams(),
    ],
    queryFn: () =>
      firstValueFrom(
        this.saleOrderService
          .getSaleOrders(
            this.appliedSearchParams(),
            this.limitPerPage(),
            this.paginationService.currentPage(),
          )
          .pipe(
            tap(
              (response) => response.data.length < 1 && this.setDefaultLimit(),
            ),
          ),
      ),
    staleTime: 30_000,
  }));

  titleData = computed(() => ({
    name: 'ordenes de venta',
    count: this.saleOrderQuery.data()?.meta.total,
  }));

  setDefaultLimit(term?: string) {
    this.route.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { page: 1, query: term },
      queryParamsHandling: 'merge',
    });
  }

  idSelected = computed(() => this.saleOrderService.selectedSaleOrderId());

  deselectSaleOrder() {
    this.saleOrderService.selectedSaleOrderId.set(0);
  }

  setFrom(dateValue: string) {
    this.formSearchParams.update((params) => ({ ...params, from: dateValue }));
  }

  setTo(dateValue: string) {
    this.formSearchParams.update((params) => ({ ...params, to: dateValue }));
  }

  setSearch(value: string) {
    this.formSearchParams.update((params) => ({
      ...params,
      search: value,
    }));
  }

  setMinTotal(value: string) {
    this.formSearchParams.update((params) => ({
      ...params,
      minTotal: value,
    }));
  }

  setMaxTotal(value: string) {
    this.formSearchParams.update((params) => ({
      ...params,
      maxTotal: value,
    }));
  }

  setStatus(event: Event) {
    const status = (event.target as HTMLSelectElement).value;
    this.formSearchParams.update((params) => ({ ...params, status }));
  }

  /** Chips de tipo DTE: filtro instantáneo, sin esperar el debounce. */
  setDteTypeChip(dteType: string) {
    if (this.formSearchParams().dteType === dteType) return;
    this.formSearchParams.update((params) => ({ ...params, dteType }));
    this.onSearch();
  }

  retryList() {
    this.saleOrderQuery.refetch();
  }

  setDteType(event: Event) {
    const dteType = (event.target as HTMLSelectElement).value;
    this.formSearchParams.update((params) => ({ ...params, dteType }));
  }

  onSearch(): void {
    if (this.saleOrderQuery.isFetching()) return;
    const params = this.formSearchParams();
    this.searchNonce.update((n) => n + 1);
    this.route.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        page: 1,
        from: params.from,
        to: params.to,
        search: params.search,
        minTotal: params.minTotal,
        maxTotal: params.maxTotal,
        status: params.status,
        dteType: params.dteType,
      },
      queryParamsHandling: 'merge',
    });
    this.appliedSearchParams.set(params);
  }

  onNewLimit(newLimit: number) {
    this.limitPerPage.set(newLimit);
    this.setSearchParamInUrl();
  }

  setSearchParamInUrl() {
    this.route.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { page: 1, ...this.formSearchParams() },
      queryParamsHandling: 'merge',
    });
  }

  saleOrderStatusList = saleOrderStatusList;

  saleOrderPreviewData = computed(() => {
    return this.saleOrderQuery
      .data()
      ?.data.find((order) => order.id === this.idSelected());
  });

  downloadingDocs = signal(false);
  readonly pdfViewer = viewChild(PdfPreviewComponent);
  readonly previewLoading = signal(false);

  async previewInvoicePdf(): Promise<void> {
    const id = this.idSelected();
    if (!id || this.previewLoading()) return;
    this.previewLoading.set(true);
    try {
      const documents = await firstValueFrom(this.saleOrderService.getDocuments(id).pipe(takeUntilDestroyed(this.destroyRef)));
      if (this.destroyed || this.idSelected() !== id) return;
      if (!documents.pdf?.url) {
        this.alertService.showWarning('Esta venta no tiene PDF original adjunto.');
        return;
      }
      await this.pdfViewer()?.open(documents.pdf.url, 'Factura de venta');
    } catch {
      if (!this.destroyed) this.alertService.showError('No se pudo obtener el PDF de esta venta.');
    } finally {
      if (!this.destroyed) this.previewLoading.set(false);
    }
  }

  readonly jsonPreviewDialog = viewChild<ElementRef<HTMLDialogElement>>('jsonPreviewDialog');
  readonly jsonPreviewText = signal('');
  private jsonPreviewAbort?: AbortController;

  async previewInvoiceJson(): Promise<void> {
    const id = this.idSelected();
    if (!id || this.previewLoading()) return;
    const controller = new AbortController();
    this.jsonPreviewAbort = controller;
    this.previewLoading.set(true);
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const documents = await firstValueFrom(this.saleOrderService.getDocuments(id).pipe(requestTimeout(30_000), takeUntilDestroyed(this.destroyRef)));
      if (this.destroyed || this.idSelected() !== id || controller.signal.aborted) return;
      if (!documents.json?.url) {
        this.alertService.showWarning('Esta venta no tiene JSON original adjunto.');
        return;
      }
      const response = await fetch(documents.json.url, { signal: controller.signal });
      if (!response.ok) throw new Error('Document unavailable');
      const value: unknown = await response.json();
      if (this.destroyed || this.idSelected() !== id || controller.signal.aborted) return;
      this.jsonPreviewText.set(JSON.stringify(value, null, 2));
      this.jsonPreviewDialog()?.nativeElement.showModal();
    } catch {
      if (!this.destroyed && this.idSelected() === id) this.alertService.showError('No se pudo obtener o leer el JSON de esta venta. Intenta nuevamente.');
    } finally {
      clearTimeout(timeout);
      if (this.jsonPreviewAbort === controller) this.jsonPreviewAbort = undefined;
      if (!this.destroyed) this.previewLoading.set(false);
    }
  }

  closeJsonPreview(): void {
    this.jsonPreviewText.set('');
    this.jsonPreviewDialog()?.nativeElement.close();
  }

  documentChoice = signal<'pdf' | 'json' | 'zip'>('pdf');

  /** Descarga según lo elegido en el modal (el blob fuerza descarga directa,
   * sin que Firefox abra el JSON en pestaña). */
  confirmDocumentDownload() {
    const id = this.idSelected();
    if (!id || this.downloadingDocs()) return;
    const choice = this.documentChoice();
    (document.getElementById('sale_order_document_choice') as HTMLDialogElement | null)?.close();
    this.downloadingDocs.set(true);
    if (choice === 'zip') {
      firstValueFrom(this.saleOrderService.downloadOrderZip(id)).then(
        (response) => {
          this.downloadingDocs.set(false);
          const disposition = response.headers.get('Content-Disposition') ?? '';
          const match = /filename="([^"]+)"/.exec(disposition);
          this.saveBlob(
            response.body ?? new Blob(),
            match?.[1] ?? `${this.documentBaseName()}.zip`,
          );
        },
        (error: { message?: string }) => {
          this.downloadingDocs.set(false);
          this.alertService.showError(error?.message ?? 'Error al generar el ZIP');
        },
      );
      return;
    }
    firstValueFrom(this.saleOrderService.getDocuments(id)).then(
      (result) => {
        this.downloadingDocs.set(false);
        if (choice === 'pdf') {
          if (result.pdf) {
            this.downloadBlob(result.pdf.url, `${result.filename}.pdf`);
          } else {
            this.alertService.showWarning('Esta venta no tiene PDF original adjunto');
          }
        } else if (result.json?.url) {
          this.downloadBlob(result.json.url, `${result.filename}.json`);
        } else {
          this.alertService.showWarning('Esta venta no tiene el archivo original seleccionado');
        }
      },
      (error: { message?: string }) => {
        this.downloadingDocs.set(false);
        this.alertService.showError(error?.message ?? 'Error al generar documentos');
      },
    );
  }

  private documentBaseName(): string {
    return this.saleOrderPreviewData()?.documentNumber ?? 'documento';
  }

  private async downloadBlob(url: string, filename: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      this.saveBlob(await response.blob(), filename);
    } catch {
      window.open(url, '_blank');
    }
  }

  private saveBlob(blob: Blob, filename: string) {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    // Firefox ignora el clic si el ancla no está en el DOM.
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  zipDownloading = signal(false);

  downloadZip(): void {
    if (this.zipDownloading()) return;
    const params = this.appliedSearchParams();
    if (!params.from || !params.to) {
      this.alertService.showError('Selecciona el rango de fechas para el ZIP.');
      return;
    }
    this.zipDownloading.set(true);
    this.saleOrderService.requestDocumentsZip(params.from, params.to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response): void => {
          this.zipDownloading.set(false);
          const disposition = response.headers.get('Content-Disposition') ?? '';
          const match = /filename="([^"]+)"/.exec(disposition);
          if (response.body) this.saveBlob(response.body, match?.[1] ?? `ventas-${params.from}_${params.to}.zip`);
        },
        error: (): void => {
          if (this.destroyed) return;
          this.zipDownloading.set(false);
          this.alertService.showError('No se pudo descargar el ZIP de originales');
        },
      });
  }

  downloadExcel() {
    const params = this.appliedSearchParams();
    if (!params.from || !params.to) {
      this.alertService.showError('Selecciona el rango de fechas para el reporte.');
      return;
    }
    firstValueFrom(
      this.saleOrderService.downloadExcelSummary(params.from ?? undefined, params.to ?? undefined),
    ).then(
      (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resumen-facturas-${params.from ?? 'todo'}_${params.to ?? 'todo'}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      },
      () => this.alertService.showError('Error al generar el Excel'),
    );
  }
  readonly selectedRowNumber = listSelectionNumber(
    this.saleOrderService.selectedSaleOrderId, this.paginationService.currentPage, () => this.saleOrderQuery.data(),
  );
}
