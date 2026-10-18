import { FilterPanelComponent } from '../../../shared/components/filter-panel/filter-panel.component';
import { listSelectionNumber } from '../../../shared/utils/list-selection';
import {
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
  effect,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import {
  injectMutation,
  injectQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom, tap } from 'rxjs';

import { WarehouseService } from '../../services/warehouse.service';


import { WarehouseTableComponent } from '../../components/warehouse-table/warehouse-table.component';
import { PaginationService } from '../../../shared/components/pagination/pagination.service';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

import { DeleteActionModalService } from '../../../shared/components/delete-action-modal/deleteActionModal.service';
import { DeleteActionModalComponent } from '../../../shared/components/delete-action-modal/delete-action-modal.component';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { LimitComponent } from '../../../shared/components/limit/limit.component';
import { SearchComponent } from '../../../shared/components/search/search.component';
import { TitleComponent } from '../../../shared/components/title/title.component';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { QuickViewComponent } from '../../components/quick-view/quick-view.component';
import { WarehouseFormModalComponent } from '../../components/warehouse-form-modal/warehouse-form-modal.component';
import { invalidateCatalogCaches } from '../../../shared/utils/invalidate-catalog-caches.util';

@Component({
  selector: 'app-warehouses-page.component',
  imports: [
    FilterPanelComponent,
    WarehouseTableComponent,
    PaginationComponent,
    AlertComponent,
    LimitComponent,
    SearchComponent,
    TitleComponent,
    ErrorBannerComponent,
    QuickViewComponent,
    WarehouseFormModalComponent,
    DeleteActionModalComponent,
  ],
  templateUrl: './warehouses-page.component.html',
})
export class WarehousesPageComponent {
  @ViewChild('warehouseFormModal')
  warehouseFormModal!: WarehouseFormModalComponent;

  // Angular injects
  route = inject(Router);
  activatedRoute = inject(ActivatedRoute);
  queryClient = inject(QueryClient);

  // custom injects
  warehouseService = inject(WarehouseService);
  paginationService = inject(PaginationService);
  deleteModalService = inject(DeleteActionModalService);
  alertService = inject(AlertService);

  // Query Search variable
  query = linkedSignal(
    () => this.activatedRoute.snapshot.queryParamMap.get('query') ?? '',
  );

  isOpen = signal<boolean>(false);

  openToggle() {
    this.isOpen.update((value) => !value);
  }

  // Paginator variables
  limitPerPage = signal<number>(10);
  limitList = signal<number[]>([10, 20, 50, 100]);
  eskeletonElements = computed(() => new Array(this.limitPerPage()).fill(0));

  // Search param variables
  onSearch(term: string): void {
    if (this.warehousesQuery.isFetching()) return;
    this.query.set(term);
    this.setDefaultLimit(this.query());
  }

  onResetFilters(): void {
    if (this.warehousesQuery.isFetching()) return;
    this.onSearch('');
  }

  // Change limit
  onNewLimit(newLimit: number) {
    this.limitPerPage.set(newLimit);
    this.setDefaultLimit(this.query());
  }

  // Get Warehouses using tanstack
  warehousesQuery = injectQuery(() => ({
    queryKey: [
      'warehouses',
      this.limitPerPage(),
      this.paginationService.currentPage(),
      this.query(),
    ],

    queryFn: () =>
      firstValueFrom(
        this.warehouseService
          .getWarehouses(
            this.paginationService.currentPage(),
            this.limitPerPage(),
            this.query(),
          )
          .pipe(
            tap((warehouse) => warehouse.data.length < 1 && this.setDefaultLimit()),
          ),
      ),
    staleTime: 5000 * 60,
  }));
  titleData = computed(() => ({
    name: 'bodegas',
    count: this.warehousesQuery.data()?.meta.total,
  }));

  // Every search or limit modified should redirect to the first page
  setDefaultLimit(term?: string) {
    this.route.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { page: 1, query: term },
      queryParamsHandling: 'merge',
    });
  }

  // Delete action
  deleteWarehouseEffect = effect(() => {
    if (this.deleteModalService.state() === 'confirming') {
      this.onDeleteConfirmed();
    }
  });

  onDeleteConfirmed() {
    this.deleteModalService.state.set('loading');
    const id = this.warehouseService.warehouseIdSelected();
    this.mutationDelete.mutate(id);
  }

  mutationDelete = injectMutation(() => ({
    mutationFn: (id: number) =>
      firstValueFrom(this.warehouseService.deleteWarehouse(id)),
    onSuccess: () => {
      this.deleteModalService.state.set('finished');
      this.queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      invalidateCatalogCaches(this.queryClient);
      this.warehouseService.warehouseIdSelected.set(0);
      this.alertService.showSuccess('Bodega eliminada con éxito');
    },
    onError: (exception) => {
      this.deleteModalService.state.set('finished');
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  warehouse = computed(() => {
    return this.warehousesQuery
      .data()
      ?.data.find((warehouse) => warehouse.id === this.idSelected());
  });

  idSelected = computed(() => this.warehouseService.warehouseIdSelected());
  routeToRedirect = signal('/warehouses/detail');

  openCreateModal() {
    this.warehouseFormModal?.openForCreate();
  }

  openEditModal() {
    const targetWarehouse = this.warehouse();
    if (targetWarehouse) {
      this.warehouseFormModal?.openForEdit(targetWarehouse);
    }
  }

  onWarehouseSaved(): void {
    this.warehouseService.warehouseIdSelected.set(0);
  }
  readonly selectedRowNumber = listSelectionNumber(
    this.warehouseService.warehouseIdSelected, this.paginationService.currentPage, () => this.warehousesQuery.data(),
  );
}