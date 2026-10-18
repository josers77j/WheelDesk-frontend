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

import { BrandService } from '../../services/brand.service';

import { BrandTableComponent } from '../../components/brand-table.component/brand-table.component';
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
import { BrandFormModalComponent } from '../../components/brand-form-modal/brand-form-modal.component';
import { invalidateCatalogCaches } from '../../../shared/utils/invalidate-catalog-caches.util';

@Component({
  selector: 'app-brands-page.component',
  imports: [
    FilterPanelComponent,
    BrandTableComponent,
    PaginationComponent,
    AlertComponent,
    LimitComponent,
    SearchComponent,
    TitleComponent,
    ErrorBannerComponent,
    QuickViewComponent,
    BrandFormModalComponent,
    DeleteActionModalComponent,
  ],
  templateUrl: './brands-page.component.html',
})
export class BrandsPageComponent {
  @ViewChild('brandFormModal') brandFormModal!: BrandFormModalComponent;
  // Angular injects
  route = inject(Router);
  activatedRoute = inject(ActivatedRoute);
  queryClient = inject(QueryClient);

  // custom injects
  brandService = inject(BrandService);
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
    if (this.brandsQuery.isFetching()) return;
    this.query.set(term);
    this.setDefaultLimit(this.query());
  }

  onResetFilters(): void {
    if (this.brandsQuery.isFetching()) return;
    this.onSearch('');
  }

  // Change limit
  onNewLimit(newLimit: number) {
    this.limitPerPage.set(newLimit);
    this.setDefaultLimit(this.query());
  }

  // Get Brands using tanstack
  brandsQuery = injectQuery(() => ({
    queryKey: [
      'brands',
      this.limitPerPage(),
      this.paginationService.currentPage(),
      this.query(),
    ],

    queryFn: () =>
      firstValueFrom(
        this.brandService
          .getBrands(
            this.paginationService.currentPage(),
            this.limitPerPage(),
            this.query(),
          )
          .pipe(
            tap((brand) => brand.data.length < 1 && this.setDefaultLimit()),
          ),
      ),
    staleTime: 5000 * 60,
  }));
  titleData = computed(() => ({
    name: 'marcas',
    count: this.brandsQuery.data()?.meta.total,
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

  deleteBrandEffect = effect(() => {
    if (this.deleteModalService.state() === 'confirming') {
      this.onDeleteConfirmed();
    }
  });

  onDeleteConfirmed() {
    this.deleteModalService.state.set('loading');
    const id = this.brandService.brandIdSelected();
    this.mutationDelete.mutate(id);
  }

  mutationDelete = injectMutation(() => ({
    mutationFn: (id: number) =>
      firstValueFrom(this.brandService.deleteBrand(id)),
    onSuccess: () => {
      this.deleteModalService.state.set('finished');
      this.queryClient.invalidateQueries({ queryKey: ['brands'] });
      invalidateCatalogCaches(this.queryClient);
      this.brandService.brandIdSelected.set(0);
      this.alertService.showSuccess('Marca eliminada con éxito');
    },
    onError: (exception) => {
      this.deleteModalService.state.set('finished');
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  brand = computed(() => {
    return this.brandsQuery
      .data()
      ?.data.find((brand) => brand.id === this.idSelected());
  });

  idSelected = computed(() => this.brandService.brandIdSelected());
  routeToRedirect = signal('/brands/detail');

  openCreateModal() {
    this.brandFormModal?.openForCreate();
  }

  openEditModal() {
    const targetBrand = this.brand();
    if (targetBrand) {
      this.brandFormModal?.openForEdit(targetBrand);
    }
  }

  onBrandSaved(): void {
    this.brandService.brandIdSelected.set(0);
  }
  readonly selectedRowNumber = listSelectionNumber(
    this.brandService.brandIdSelected, this.paginationService.currentPage, () => this.brandsQuery.data(),
  );
}
