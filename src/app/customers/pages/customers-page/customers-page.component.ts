import { FilterPanelComponent } from '../../../shared/components/filter-panel/filter-panel.component';
import { listSelectionNumber } from '../../../shared/utils/list-selection';
import {
  Component,
  ViewChild,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';

import { CustomerService } from '../../services/customer.service';
import { Router, ActivatedRoute } from '@angular/router';
import {
  QueryClient,
  injectQuery,
  injectMutation,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom, tap } from 'rxjs';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { DeleteActionModalService } from '../../../shared/components/delete-action-modal/deleteActionModal.service';
import { DeleteActionModalComponent } from '../../../shared/components/delete-action-modal/delete-action-modal.component';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { LimitComponent } from '../../../shared/components/limit/limit.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { PaginationService } from '../../../shared/components/pagination/pagination.service';
import { SearchComponent } from '../../../shared/components/search/search.component';
import { TitleComponent } from '../../../shared/components/title/title.component';
import { CustomerTableComponent } from '../../components/customer-table/customer-table.component';
import { QuickViewComponent } from '../../components/quick-view/quick-view.component';
import { CustomerFormModalComponent } from '../../components/customer-form-modal/customer-form-modal.component';
import { invalidateCatalogCaches } from '../../../shared/utils/invalidate-catalog-caches.util';

@Component({
  selector: 'app-customers-page.component',
  imports: [
    FilterPanelComponent,
    TitleComponent,
    CustomerTableComponent,
    PaginationComponent,
    DeleteActionModalComponent,
    AlertComponent,
    LimitComponent,
    SearchComponent,
    ErrorBannerComponent,
    CustomerFormModalComponent,
    QuickViewComponent,
  ],
  templateUrl: './customers-page.component.html',
})
export class CustomersPageComponent {
  // Angular injects
  route = inject(Router);
  activatedRoute = inject(ActivatedRoute);
  queryClient = inject(QueryClient);

  // custom injects
  customerService = inject(CustomerService);
  paginationService = inject(PaginationService);
  deleteModalService = inject(DeleteActionModalService);
  alertService = inject(AlertService);

  // Query Search variable
  query = linkedSignal(
    () => this.activatedRoute.snapshot.queryParamMap.get('query') ?? '',
  );

  // Paginator variables
  limitPerPage = signal<number>(10);
  limitList = signal<number[]>([10, 20, 50, 100]);
  eskeletonElements = computed(() => new Array(this.limitPerPage()).fill(0));

  isOpen = signal<boolean>(false);
  openToggle() {
    this.isOpen.update((value) => !value);
  }
  // Search param variables
  onSearch(term: string): void {
    if (this.CustomersQuery.isFetching()) return;
    this.query.set(term);
    this.setDefaultLimit(this.query());
  }

  onResetFilters(): void {
    if (this.CustomersQuery.isFetching()) return;
    this.onSearch('');
  }

  // Change limit
  onNewLimit(newLimit: number) {
    this.limitPerPage.set(newLimit);
    this.setDefaultLimit(this.query());
  }

  // Get Customers using tanstack
  CustomersQuery = injectQuery(() => ({
    queryKey: [
      'customers',
      this.limitPerPage(),
      this.paginationService.currentPage(),
      this.query(),
    ],

    queryFn: () =>
      firstValueFrom(
        this.customerService
          .getCustomers(
            this.paginationService.currentPage(),
            this.limitPerPage(),
            this.query(),
          )
          .pipe(
            tap(
              (customer) => customer.data.length < 1 && this.setDefaultLimit(),
            ),
          ),
      ),
    staleTime: 5000 * 60,
  }));

  titleData = computed(() => ({
    name: 'Clientes',
    count: this.CustomersQuery.data()?.meta.total,
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
  deleteCustomerEffect = effect(() => {
    if (this.deleteModalService.state() === 'confirming') {
      this.onDeleteConfirmed();
    }
  });

  onDeleteConfirmed() {
    this.deleteModalService.state.set('loading');
    const id = this.customerService.customerIdSelected();
    this.mutationDelete.mutate(id);
  }

  mutationDelete = injectMutation(() => ({
    mutationFn: (id: number) =>
      firstValueFrom(this.customerService.deleteCustomer(id)),
    onSuccess: () => {
      this.deleteModalService.state.set('finished');
      this.queryClient.invalidateQueries({ queryKey: ['customers'] });
      invalidateCatalogCaches(this.queryClient);
      this.customerService.customerIdSelected.set(0);
      this.alertService.showSuccess('Cliente eliminado con éxito');
    },
    onError: (exception) => {
      this.deleteModalService.state.set('finished');
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  routeToRedirect = signal('/customers/detail');
  idSelected = computed(() => this.customerService.customerIdSelected());

  // Modal API (igual que brands-page)
  @ViewChild('customerFormModal') customerFormModal!: CustomerFormModalComponent;

  openCreateModal() {
    this.customerFormModal?.openForCreate();
  }

  openEditModal() {
    const selected = this.customer();
    if (selected) this.customerFormModal?.openForEdit(selected);
  }

  onCustomerSaved() {
    this.deselectCustomer();
  }

  deselectCustomer() {
    this.customerService.customerIdSelected.set(0);
  }

  customer = computed(() => {
    return this.CustomersQuery.data()?.data.find(
      (customer) => customer.id === this.idSelected(),
    );
  });
  readonly selectedRowNumber = listSelectionNumber(
    this.customerService.customerIdSelected, this.paginationService.currentPage, () => this.CustomersQuery.data(),
  );
}
