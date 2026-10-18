import { FilterPanelComponent } from '../../../shared/components/filter-panel/filter-panel.component';
import { AuthService } from '../../../auth/services/auth.service';
import { listSelectionNumber } from '../../../shared/utils/list-selection';
import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { TitleComponent } from '../../../shared/components/title/title.component';
import {
  injectMutation,
  injectQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom, tap } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

import { PaginationService } from '../../../shared/components/pagination/pagination.service';
import { DeleteActionModalService } from '../../../shared/components/delete-action-modal/deleteActionModal.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { ProviderService } from '../../services/provider.service';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { LimitComponent } from '../../../shared/components/limit/limit.component';
import { SearchComponent } from '../../../shared/components/search/search.component';
import { ProviderTableComponent } from '../../components/provider-table/provider-table.component';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { QuickViewComponent } from '../../components/quick-view/quick-view.component';
import { ProviderFormModalComponent } from '../../components/provider-form-modal/provider-form-modal.component';
import { DeleteActionModalComponent } from '../../../shared/components/delete-action-modal/delete-action-modal.component';

import { invalidateCatalogCaches } from '../../../shared/utils/invalidate-catalog-caches.util';

@Component({
  selector: 'app-providers-page',
  imports: [
    FilterPanelComponent,
    TitleComponent,
    ProviderTableComponent,
    PaginationComponent,
    DeleteActionModalComponent,
    AlertComponent,
    LimitComponent,
    SearchComponent,
    ErrorBannerComponent,
    QuickViewComponent,
    ProviderFormModalComponent,
  ],
  templateUrl: './providers-page.component.html',
})
export class ProvidersPageComponent {
  readonly authService = inject(AuthService);
  // Angular injects
  route = inject(Router);
  activatedRoute = inject(ActivatedRoute);
  queryClient = inject(QueryClient);

  // custom injects
  providerService = inject(ProviderService);
  paginationService = inject(PaginationService);
  deleteModalService = inject(DeleteActionModalService);
  alertService = inject(AlertService);

  isOpen = signal<boolean>(false);
  openToggle() {
    this.isOpen.update((value) => !value);
  }
  // Query Search variable
  query = linkedSignal(
    () => this.activatedRoute.snapshot.queryParamMap.get('query') ?? '',
  );

  // Paginator variables
  limitPerPage = signal<number>(10);
  limitList = signal<number[]>([10, 20, 50, 100]);
  eskeletonElements = computed(() => new Array(this.limitPerPage()).fill(0));

  // Search param variables
  onSearch(term: string): void {
    if (this.ProvidersQuery.isFetching()) return;
    this.query.set(term);
    this.setDefaultLimit(this.query());
  }

  onResetFilters(): void {
    if (this.ProvidersQuery.isFetching()) return;
    this.onSearch('');
  }

  // Change limit
  onNewLimit(newLimit: number) {
    this.limitPerPage.set(newLimit);
    this.setDefaultLimit(this.query());
  }

  // Get Brands using tanstack
  ProvidersQuery = injectQuery(() => ({
    queryKey: [
      'providers',
      this.limitPerPage(),
      this.paginationService.currentPage(),
      this.query(),
    ],

    queryFn: () =>
      firstValueFrom(
        this.providerService
          .getProviders(
            this.paginationService.currentPage(),
            this.limitPerPage(),
            this.query(),
          )
          .pipe(
            tap(
              (provider) => provider.data.length < 1 && this.setDefaultLimit(),
            ),
          ),
      ),
    staleTime: 5000 * 60,
  }));

  titleData = computed(() => ({
    name: 'proveedores',
    count: this.ProvidersQuery.data()?.meta.total,
  }));

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
    const id = this.providerService.providerIdSelected();
    this.mutationDelete.mutate(id);
  }

  mutationDelete = injectMutation(() => ({
    mutationFn: (id: number) =>
      firstValueFrom(this.providerService.deleteProvider(id)),
    onSuccess: () => {
      this.deleteModalService.state.set('finished');
      this.queryClient.invalidateQueries({ queryKey: ['providers'] });
      invalidateCatalogCaches(this.queryClient);
      this.providerService.providerIdSelected.set(0);
      this.alertService.showSuccess('Proveedor eliminado con éxito');
    },
    onError: (exception) => {
      this.deleteModalService.state.set('finished');
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  routeToRedirect = signal('/providers/detail');
  idSelected = computed(() => this.providerService.providerIdSelected());

  private readonly providerFormModal =
    viewChild<ProviderFormModalComponent>('providerFormModal');

  openCreateModal(): void {
    if (!this.authService.isAdmin()) return;
    this.providerFormModal()?.openForCreate();
  }

  openEditModal() {
    const target = this.providerPreviewData();
    if (target) {
      this.providerFormModal()?.openForEdit(target);
    }
  }

  onProviderSaved(): void {
    this.providerService.providerIdSelected.set(0);
  }

  deselectProvider() {
    this.providerService.providerIdSelected.set(0);
  }

  providerPreviewData = computed(() => {
    return this.ProvidersQuery.data()?.data.find(
      (provider) => provider.id === this.idSelected(),
    );
  });
  readonly selectedRowNumber = listSelectionNumber(
    this.providerService.providerIdSelected, this.paginationService.currentPage, () => this.ProvidersQuery.data(),
  );
}
