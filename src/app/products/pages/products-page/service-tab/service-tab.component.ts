import { FilterPanelComponent } from '../../../../shared/components/filter-panel/filter-panel.component';
import { listSelectionNumber } from '../../../../shared/utils/list-selection';
import {
  Component,
  ViewChild,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import {
  injectMutation,
  injectQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { PRODUCT_CATEGORY } from '../../../consts/product-category.const';
import { ProductService } from '../../../services/product.service';

import { PaginationService } from '../../../../shared/components/pagination/pagination.service';
import { DeleteActionModalService } from '../../../../shared/components/delete-action-modal/deleteActionModal.service';
import { AlertService } from '../../../../shared/components/alert/alert.service';
import { PRODUCT_TYPE } from '../../../interfaces/product-type.enum';
import { Product } from '../../../interfaces/product.interface';
import { ActivatedRoute, Router } from '@angular/router';
import { ErrorBannerComponent } from '../../../../shared/components/error-banner/error-banner.component';
import { TitleComponent } from '../../../../shared/components/title/title.component';
import { LimitComponent } from '../../../../shared/components/limit/limit.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { DeleteActionModalComponent } from '../../../../shared/components/delete-action-modal/delete-action-modal.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';

import { SearchComponent } from '../../../../shared/components/search/search.component';
import { ServiceTableComponent } from '../../../components/service-table/service-table.component';
import { QuickViewComponent } from '../../../components/quick-view/quick-view.component';
import { ServiceFormModalComponent } from '../../../components/service-form-modal/service-form-modal.component';
import { invalidateCatalogCaches } from '../../../../shared/utils/invalidate-catalog-caches.util';

@Component({
  selector: 'app-service-tab',
  imports: [
    FilterPanelComponent,
    ServiceTableComponent,
    PaginationComponent,
    DeleteActionModalComponent,
    AlertComponent,
    ServiceFormModalComponent,
    LimitComponent,
    TitleComponent,
    ErrorBannerComponent,
    SearchComponent,
    QuickViewComponent,
  ],
  templateUrl: './service-tab.component.html',
})
export class ServiceTabComponent {
  // Angular injects
  route = inject(Router);
  activatedRoute = inject(ActivatedRoute);
  queryClient = inject(QueryClient);

  readonly productType = PRODUCT_TYPE;

  // custom injects
  productService = inject(ProductService);
  paginationService = inject(PaginationService);
  deleteModalService = inject(DeleteActionModalService);
  alertService = inject(AlertService);

  // Paginator variables
  limitPerPage = signal<number>(10);
  limitList = signal<number[]>([10, 20, 50, 100]);
  eskeletonElements = computed(() => new Array(this.limitPerPage()).fill(0));

  isOpen = signal<boolean>(false);
  openToggle() {
    this.isOpen.update((value) => !value);
  }

  query = linkedSignal(
    () => this.activatedRoute.snapshot.queryParamMap.get('query') ?? '',
  );

  // Search param variables
  onSearch(term: string) {
    this.query.set(term);
    this.setDefaultLimit(this.query());
  }

  onResetFilters() {
    this.onSearch('');
  }

  // Change limit
  onNewLimit(newLimit: number) {
    this.limitPerPage.set(newLimit);
    this.setDefaultLimit(this.query());
  }

  // Get Brands using tanstack
  serviceQuery = injectQuery(() => ({
    queryKey: [
      'services',
      this.limitPerPage(),
      this.paginationService.currentPage(),
      this.query(),
    ],

    queryFn: () =>
      firstValueFrom(
        this.productService.getProducts(
          PRODUCT_CATEGORY.SERVICE,
          this.paginationService.currentPage(),
          this.limitPerPage(),
          { filter: this.query() },
        ),
      ),
    staleTime: 5000 * 60,
  }));

  // Title
  titleData = computed(() => ({
    name: 'Servicios',
    count: this.serviceQuery.data()?.meta.total,
  }));
  placeholderInput = signal<{ provider: string; brand: string }>({
    provider: 'proveedor',
    brand: 'marca',
  });

  // Every search or limit change means to redirect the user to the first page
  setDefaultLimit(term?: string) {
    this.route.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { page: 1, query: term },
      queryParamsHandling: 'merge',
    });
  }

  // Delete action
  deleteBrandEffect = effect(() => {
    if (this.deleteModalService.state() === 'confirming') {
      this.onDeleteConfirmed();
    }
  });

  onDeleteConfirmed() {
    this.deleteModalService.state.set('loading');
    const id = this.productService.productIdSelected();
    this.mutationDelete.mutate(id);
  }

  mutationDelete = injectMutation(() => ({
    mutationFn: (id: number) =>
      firstValueFrom(this.productService.deleteProduct(id)),
    onSuccess: () => {
      this.deleteModalService.state.set('finished');
      this.queryClient.invalidateQueries({ queryKey: ['services'] });
      invalidateCatalogCaches(this.queryClient);
      this.productService.productIdSelected.set(0);
      this.alertService.showSuccess('Producto eliminado con éxito');
    },
    onError: (exception) => {
      this.deleteModalService.state.set('finished');
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  routeToRedirect = signal('/products/detail');
  idSelected = computed(() => this.productService.productIdSelected());

  @ViewChild('serviceFormModal') serviceFormModal!: ServiceFormModalComponent;

  openCreateModal() {
    this.serviceFormModal?.openForCreate();
  }

  openEditModal() {
    const selected = this.servicePreviewData();
    if (selected) this.serviceFormModal?.openForEdit(selected);
  }

  onProductSaved() {
    this.deselectProduct();
  }

  deselectProduct() {
    this.productService.productIdSelected.set(0);
  }

  sanitizedNumber(value?: string | number | null) {
    if (value === null || value === undefined || value === '') return null;

    const sanitizedValue = Number(value); // or +value
    return Number.isFinite(sanitizedValue) ? sanitizedValue : null;
  }

  servicePreviewData = computed((): Product | null => {
    return this.serviceQuery
      .data()
      ?.data.find((service) => service.id === this.idSelected()) ?? null;
  });
  readonly selectedRowNumber = listSelectionNumber(
    this.productService.productIdSelected, this.paginationService.currentPage, () => this.serviceQuery.data(),
  );
}
