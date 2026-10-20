import { FilterPanelComponent } from '../../../shared/components/filter-panel/filter-panel.component';
import { PurchaseDocumentsModalComponent } from '../../components/purchase-documents-modal/purchase-documents-modal.component';
import { listSelectionNumber } from '../../../shared/utils/list-selection';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { PurchaseOrderTableComponent } from '../../components/purchase-order-table/purchase-order-table.component';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import {
  QueryClient,
  injectMutation,
  injectQuery,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom, map, tap } from 'rxjs';
import {
  loadFilterValue,
  saveFilterValue,
} from '../../../shared/utils/filter-storage.util';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { DeleteActionModalService } from '../../../shared/components/delete-action-modal/deleteActionModal.service';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';

import { LimitComponent } from '../../../shared/components/limit/limit.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { PaginationService } from '../../../shared/components/pagination/pagination.service';

import { TitleComponent } from '../../../shared/components/title/title.component';
import { ComboboxComponent } from '../../../shared/components/combobox/combobox.component';
import { DateRangeComponent } from '../../../shared/components/date-range/date-range.component';
import { ProviderService } from '../../../providers/services/provider.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { sameSearchParams } from '../../../shared/utils/search-params-compare.util';
import { PAGINATOR_DEFAULT_SETTINGS } from '../../../shared/consts/pagination-settings.const';
import { ValueParams } from '../../../shared/components/combobox/interfaces/search-param.interface';

import { QuickViewComponent } from '../../components/quick-view/quick-view.component';
import { SearchParams } from '../../interfaces/search-param.interface';
import { purchaseOrderStatusList } from '../../enums/purchase-order-status.enum';
import { ActionModalComponent } from '../../components/action-modal/action-modal.component';
import { ActionModalService } from '../../components/action-modal/actionModal.service';
import { ApproveModalComponent } from '../../components/approve-modal/approve-modal.component';
import { PurchaseOrder } from '../../interfaces/purchase-order.interface';
import { PURCHASE_ORDER_STATUS } from '../../enums/purchase-order-status.enum';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-purchase-orders-page',
  imports: [
    FilterPanelComponent,
    PurchaseOrderTableComponent,
    PurchaseDocumentsModalComponent,
    PaginationComponent,
    AlertComponent,
    LimitComponent,
    RouterLink,
    TitleComponent,
    ErrorBannerComponent,
    ComboboxComponent,
    DateRangeComponent,
    QuickViewComponent,
    ActionModalComponent,
    ApproveModalComponent,
    SkeletonComponent,
  ],
  templateUrl: './purchase-orders-page.component.html',
})
export class PurchaseOrdersPageComponent {
  readonly documentSelection = signal<number[]>([]);
  readonly documentsModal = viewChild(PurchaseDocumentsModalComponent);
  toggleDocumentSelection(id: number): void {
    const current = this.documentSelection();
    if (current.includes(id)) this.documentSelection.set(current.filter(value => value !== id));
    else if (current.length >= 20) this.alertService.showWarning('Seleccione como máximo 20 compras por operación.');
    else this.documentSelection.set([...current, id]);
  }
  updateDocumentSelection(ids: number[]): void {
    this.documentSelection.set([...ids]);
  }
  route = inject(Router);
  activatedRoute = inject(ActivatedRoute);
  queryClient = inject(QueryClient);

  // custom injects
  purchaseOrderService = inject(PurchaseOrderService);
  paginationService = inject(PaginationService);
  deleteModalService = inject(DeleteActionModalService);
  alertService = inject(AlertService);

  providerService = inject(ProviderService);

  selectedProvider = signal<ValueParams | null>(null);

  actionModalService = inject(ActionModalService);

  isOpen = signal<boolean>(false);
  openToggle() {
    this.isOpen.update((value) => !value);
  }
  // Paginator variables
  limitPerPage = signal<number>(10);
  limitList = signal<number[]>([10, 20, 50, 100]);
  eskeletonElements = computed(() => new Array(this.limitPerPage()).fill(0));

  urlSearchParams = computed<SearchParams>(() => {
    const map = this.queryParamsSignal();

    return {
      from: map.get('from'),
      to: map.get('to'),
      documentNumber: map.get('documentNumber'),
      status: map.get('status'),
      providerId: this.sanitizedNumber(map.get('providerId')),
    };
  });

  queryParamsSignal = toSignal(this.activatedRoute.queryParamMap, {
    initialValue: this.activatedRoute.snapshot.queryParamMap,
  });

  // Search params
  formSearchParams = signal<SearchParams>({
    from: '',
    to: '',
    documentNumber: '',
    status: '',
    providerId: null,
  });

  sincronyzedUrlSearchParams = effect(() => {
    const params = this.urlSearchParams();

    this.formSearchParams.set(params);
    this.appliedSearchParams.set(params);
  });

  setFrom(dateValue: string) {
    this.formSearchParams.update((params) => ({
      ...params,
      from: dateValue,
    }));
  }

  setTo(dateValue: string) {
    this.formSearchParams.update((params) => ({
      ...params,
      to: dateValue,
    }));
  }

  paginatorDefaultSettings = signal(PAGINATOR_DEFAULT_SETTINGS);

  setProvider(provider: ValueParams | null) {
    this.formSearchParams.update((params) => ({
      ...params,
      providerId: provider?.id,
    }));
    // El elegido ya trae {id, name}: sin fetch adicional.
    this.selectedProvider.set(provider);
    saveFilterValue(
      'filter-provider',
      provider ? { id: provider.id, name: provider.name } : null,
    );
  }

  providerComboboxOutput = signal<string>('');
  /** El filtro de proveedor solo pide al interactuar (no al montar). */
  providerTouched = signal(false);
  limit = 5;

  providersQuery = injectQuery(() => ({
    queryKey: ['provider-combobox', this.providerComboboxOutput()],

    queryFn: () =>
      firstValueFrom(
        this.providerService.getProviderByName(
          this.limit,
          this.providerComboboxOutput(),
        ),
      ),
    staleTime: 5000 * 60,
    // Perezoso: pide al interactuar (clic o tecla), no al montar.
    enabled: this.providerTouched(),
  }));

  assignProvider = effect(() => {
    const providerId = this.formSearchParams().providerId;

    if (!providerId) {
      this.selectedProvider.set(null);
      return;
    }
    // El valor elegido ya trae {id, name}: solo se busca si viene por URL.
    if (this.selectedProvider()?.id === providerId) return;
    const saved = loadFilterValue('filter-provider');
    if (saved && saved.id === providerId) {
      this.selectedProvider.set(saved);
      return;
    }

    firstValueFrom(
      this.providerService
        .getProviderById(providerId)
        .pipe(map((provider) => this.selectedProvider.set(provider))),
    );
  });

  // Get purchase orders using tanstack
  purchaseOrderQuery = injectQuery(() => ({
    queryKey: [
      'purchase-orders',
      this.limitPerPage(),
      this.paginationService.currentPage(),
      this.appliedSearchParams(),
    ],

    queryFn: () =>
      firstValueFrom(
        this.purchaseOrderService
          .getPurchaseOrders(
            this.appliedSearchParams(),
            this.limitPerPage(),
            this.paginationService.currentPage(),
          )
          .pipe(
            tap(
              (purchaseOrder) =>
                purchaseOrder.data.length < 1 && this.setDefaultLimit(),
            ),
          ),
      ),
    staleTime: 5000 * 60,
  }));
  titleData = computed(() => ({
    name: 'ordenes de compra',
    count: this.purchaseOrderQuery.data()?.meta.total,
  }));

  // Every search or limit modified should redirect to the first page
  setDefaultLimit(term?: string) {
    this.route.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { page: 1, query: term },
      queryParamsHandling: 'merge',
    });
  }

  idSelected = computed(() =>
    this.purchaseOrderService.selectedPurchaseOrderId(),
  );
  routeToRedirect = signal('/purchase-orders/detail');
  modalTitleAction = signal<string>('');

  openActionModal(title: string) {
    this.modalTitleAction.set(title);
  }

  deselectPurchaseOrder() {
    this.purchaseOrderService.selectedPurchaseOrderId.set(0);
    this.previewOrder.set(null);
  }

  /** Detalle bajo demanda: solo al abrir Ver (seleccionar no pide). */
  previewOrder = signal<PurchaseOrder | null>(null);
  loadingPreview = signal(false);

  async openPreview() {
    const id = this.purchaseOrderService.selectedPurchaseOrderId();
    if (!id || this.loadingPreview()) return;
    this.loadingPreview.set(true);
    try {
      const order = await firstValueFrom(
        this.purchaseOrderService.getPurchaseOrder(id),
      );
      this.previewOrder.set(order);
      (
        document.getElementById('my_modal_3') as HTMLDialogElement | null
      )?.showModal();
    } catch (error: unknown) {
      const message =
        error instanceof Object && 'message' in error
          ? String((error as { message?: unknown }).message ?? 'Error al cargar la orden')
          : 'Error al cargar la orden';
      this.alertService.showError(message);
    } finally {
      this.loadingPreview.set(false);
    }
  }

  placeholderInput = signal<{ provider: string; brand: string }>({
    provider: 'proveedor',
    brand: 'marca',
  });

  setSearchParamInUrl(searchParams?: SearchParams) {
    this.route.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        page: 1,
        from: searchParams?.from,
        to: searchParams?.to,
        documentNumber: searchParams?.documentNumber,
        status: searchParams?.status,
        providerId: this.sanitizedNumber(searchParams?.providerId),
      },
      queryParamsHandling: 'merge',
    });
  }

  // Search param variables
  onSearch(): void {
    if (this.purchaseOrderQuery.isFetching()) return;
    const params = { ...this.formSearchParams(), documentNumber: this.formSearchParams().documentNumber?.trim() ?? '' };
    this.searchNonce.update((n) => n + 1);
    this.setSearchParamInUrl(params);
    this.appliedSearchParams.set(params);
  }

  // Change limit
  onNewLimit(newLimit: number) {
    this.limitPerPage.set(newLimit);
    this.setSearchParamInUrl(this.formSearchParams());
  }

  appliedSearchParams = signal<SearchParams>(this.formSearchParams());

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
        'documentNumber',
        'status',
        'providerId',
      ])
    )
      return;
    const timeout = setTimeout(() => this.onSearch(), 1000);
    onCleanup(() => clearTimeout(timeout));
  });

  onResetFilters(): void {
    if (this.purchaseOrderQuery.isFetching()) return;
    this.formSearchParams.set({
      from: '',
      to: '',
      documentNumber: '',
      status: '',
      providerId: null,
    });
    this.selectedProvider.set(null);
    this.providerComboboxOutput.set('');
    this.onSearch();
  }

  sanitizedNumber(value?: string | number | null) {
    if (value === null || value === undefined || value === '') return null;

    const sanitizedValue = Number(value); // or +value
    return Number.isFinite(sanitizedValue) ? sanitizedValue : null;
  }

  purchaseOrderStatus = purchaseOrderStatusList;
  purchaseOrderStatusEnum = PURCHASE_ORDER_STATUS;

  setPurchaseOrderStatus(event: Event) {
    const status = (event.target as HTMLSelectElement).value;
    this.formSearchParams.update((params) => ({
      ...params,
      status: status,
    }));
  }

  setDocumentNumber(value: string) {
    this.formSearchParams.update((params) => ({
      ...params,
      documentNumber: value,
    }));
  }

  clearDocumentNumber() {
    this.formSearchParams.update((params) => ({
      ...params,
      documentNumber: '',
    }));
  }

  actionType = signal({
    reject: 'Rechazar',
    pending: PURCHASE_ORDER_STATUS.PENDING,
  });

  // Delete action
  actionEffect = effect(() => {
    if (this.actionModalService.modalState() === 'confirming') {
      this.onActionConfirmed();
    }
  });

  onActionConfirmed(): void {
    if (this.mutationReject.isPending()) return;
    this.actionModalService.modalState.set('loading');
    const id = this.purchaseOrderService.selectedPurchaseOrderId();
    const modalActionType = this.actionModalService.model();

    // Defensa contra caché stale: solo PENDING puede rechazarse.
    if (this.purchaseOrderState() !== this.actionType().pending) {
      this.actionModalService.modalState.set('finished');
      this.alertService.showError(
        'Solo se pueden procesar órdenes en estado PENDIENTE',
      );
      return;
    }

    if (modalActionType === this.actionType().reject)
      this.mutationReject.mutate(id);
  }

  // Approve flow ("luego"): carga la orden completa y abre el modal de zonas.
  orderToApprove = signal<PurchaseOrder | null>(null);
  approveModalRef = viewChild(ApproveModalComponent);

  async onApproveSelected() {
    const id = this.purchaseOrderService.selectedPurchaseOrderId();
    if (!id) return;
    try {
      const order = await firstValueFrom(
        this.purchaseOrderService.getPurchaseOrder(id),
      );
      // Defensa contra caché stale: la píldora se guía por la lista, acá manda el dato fresco.
      if (order.status !== PURCHASE_ORDER_STATUS.PENDING) {
        this.alertService.showError(
          'Solo se pueden procesar órdenes en estado PENDIENTE',
        );
        return;
      }
      this.orderToApprove.set(order);
      this.approveModalRef()?.openModal();
    } catch (exception) {
      const message =
        exception instanceof Object && 'message' in exception
          ? String(exception.message)
          : 'Error al cargar la orden';
      this.alertService.showError(`Error: ${message}`);
    }
  }

  onApproved() {
    this.purchaseOrderService.selectedPurchaseOrderId.set(0);
    this.orderToApprove.set(null);
  }

  mutationReject = injectMutation(() => ({
    mutationFn: (id: number) =>
      firstValueFrom(this.purchaseOrderService.rejectPurchaseOrder(id)),
    onSuccess: () => {
      this.actionModalService.modalState.set('finished');
      this.purchaseOrderService.selectedPurchaseOrderId.set(0);
      this.queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      this.alertService.showSuccess('Orden rechazada con éxito');
    },
    onError: (exception) => {
      this.actionModalService.modalState.set('finished');
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  purchaseOrderState = computed(() => {
    return this.purchaseOrderQuery
      .data()
      ?.data.find((order) => order.id === this.idSelected())?.status;
  });
  readonly selectedRowNumber = listSelectionNumber(
    this.purchaseOrderService.selectedPurchaseOrderId, this.paginationService.currentPage, () => this.purchaseOrderQuery.data(),
  );
}
