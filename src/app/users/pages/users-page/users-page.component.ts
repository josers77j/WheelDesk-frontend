import { FilterPanelComponent } from '../../../shared/components/filter-panel/filter-panel.component';
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
import { AuthService } from '../../../auth/services/auth.service';

import { TitleComponent } from '../../../shared/components/title/title.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { DeleteActionModalComponent } from '../../../shared/components/delete-action-modal/delete-action-modal.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { LimitComponent } from '../../../shared/components/limit/limit.component';
import { SearchComponent } from '../../../shared/components/search/search.component';
import { UserTableComponent } from '../../components/user-table/user-table.component';
import { UserService } from '../../services/user.service';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { QuickViewComponent } from '../../components/quick-view/quick-view.component';
import { UserFormModalComponent } from '../../components/user-form-modal/user-form-modal.component';
import { RevokeSessionsModalComponent } from '../../components/revoke-sessions-modal/revoke-sessions-modal.component';


@Component({
  selector: 'app-users-page',
  imports: [
    FilterPanelComponent,
    TitleComponent,
    UserTableComponent,
    PaginationComponent,
    DeleteActionModalComponent,
    AlertComponent,
    LimitComponent,
    SearchComponent,
    ErrorBannerComponent,
    QuickViewComponent,
    UserFormModalComponent,
    RevokeSessionsModalComponent,
  ],
  templateUrl: './users-page.component.html',
})
export class UsersPageComponent {
  // Angular injects
  route = inject(Router);
  activatedRoute = inject(ActivatedRoute);
  queryClient = inject(QueryClient);

  // custom injects
  userService = inject(UserService);
  paginationService = inject(PaginationService);
  deleteModalService = inject(DeleteActionModalService);
  alertService = inject(AlertService);
  authService = inject(AuthService);

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

  // Search param variables
  onSearch(term: string): void {
    if (this.UsersQuery.isFetching()) return;
    this.query.set(term);
    this.setDefaultLimit(this.query());
  }

  onResetFilters(): void {
    if (this.UsersQuery.isFetching()) return;
    this.onSearch('');
  }

  // Change limit
  onNewLimit(newLimit: number) {
    this.limitPerPage.set(newLimit);
    this.setDefaultLimit(this.query());
  }

  // Get Brands using tanstack
  UsersQuery = injectQuery(() => ({
    queryKey: [
      'users',
      this.limitPerPage(),
      this.paginationService.currentPage(),
      this.query(),
    ],

    queryFn: () =>
      firstValueFrom(
        this.userService
          .getUsers(
            this.paginationService.currentPage(),
            this.limitPerPage(),
            this.query(),
          )
          .pipe(tap((user) => user.data.length < 1 && this.setDefaultLimit())),
      ),
    staleTime: 5000 * 60,
  }));
  titleData = computed(() => ({
    name: 'usuarios',
    count: this.UsersQuery.data()?.meta.total,
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
  deleteUserEffect = effect(() => {
    if (this.deleteModalService.state() === 'confirming') {
      this.onDeleteConfirmed();
    }
  });

  onDeleteConfirmed() {
    const user = this.userPreviewData();
    if (user && user.id === this.authService.user()?.id) {
      this.deleteModalService.state.set('finished');
      this.alertService.showError('No puedes eliminarte a ti mismo');
      return;
    }
    this.deleteModalService.state.set('loading');
    const id = this.userService.userIdSelected();
    this.mutationDelete.mutate(id);
  }

  mutationDelete = injectMutation(() => ({
    mutationFn: (id: number) => firstValueFrom(this.userService.deleteUser(id)),
    onSuccess: () => {
      this.deleteModalService.state.set('finished');
      this.queryClient.invalidateQueries({ queryKey: ['users'] });
      this.userService.userIdSelected.set(0);
      this.alertService.showSuccess('Usuario eliminado con éxito');
    },
    onError: (exception) => {
      this.deleteModalService.state.set('finished');
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  routeToRedirect = signal('/users/detail');
  idSelected = computed(() => this.userService.userIdSelected());

  private readonly userFormModal =
    viewChild<UserFormModalComponent>('userFormModal');

  openCreateModal() {
    this.userFormModal()?.openForCreate();
  }

  openEditModal() {
    const target = this.userPreviewData();
    if (target) {
      this.userFormModal()?.openForEdit(target);
    }
  }

  onUserSaved(): void {
    this.userService.userIdSelected.set(0);
  }

  userPreviewData = computed(() => {
    return this.UsersQuery.data()?.data.find(
      (user) => user.id === this.idSelected(),
    );
  });

  /** El usuario seleccionado tiene sesiones activas */
  hasActiveSessions = computed(
    () => (this.userPreviewData()?.refreshToken?.length ?? 0) > 0,
  );

  /** El seleccionado eres tú (no te puedes eliminar a ti mismo) */
  isSelfUser = computed(
    () => this.userPreviewData()?.id === this.authService.user()?.id,
  );

  deselectUser() {
    this.userService.userIdSelected.set(0);
  }
  readonly selectedRowNumber = listSelectionNumber(
    this.userService.userIdSelected, this.paginationService.currentPage, () => this.UsersQuery.data(),
  );
}
