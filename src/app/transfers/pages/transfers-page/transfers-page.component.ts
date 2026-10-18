import { FilterPanelComponent } from '../../../shared/components/filter-panel/filter-panel.component';
import { listSelectionNumber } from '../../../shared/utils/list-selection';
import { AuthService } from '../../../auth/services/auth.service';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  injectMutation,
  injectQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom, tap } from 'rxjs';

import { TransferService } from '../../services/transfer.service';

import { TRANSFER_STATUS, transferStatusList } from '../../enums/transfer-status.enum';

import { TransferTableComponent } from '../../components/transfer-table/transfer-table.component';
import { PaginationService } from '../../../shared/components/pagination/pagination.service';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { LimitComponent } from '../../../shared/components/limit/limit.component';
import { TitleComponent } from '../../../shared/components/title/title.component';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { QuickViewComponent } from '../../components/quick-view/quick-view.component';
import { ActionModalComponent } from '../../../purchases-order/components/action-modal/action-modal.component';
import { ActionModalService } from '../../../purchases-order/components/action-modal/actionModal.service';
import { DateRangeComponent } from '../../../shared/components/date-range/date-range.component';

@Component({
  selector: 'app-transfers-page',
  imports: [
    FilterPanelComponent,
    TransferTableComponent,
    PaginationComponent,
    AlertComponent,
    LimitComponent,
    RouterLink,
    TitleComponent,
    ErrorBannerComponent,
    QuickViewComponent,
    ActionModalComponent,
    DateRangeComponent,
  ],
  templateUrl: './transfers-page.component.html',
})
export class TransfersPageComponent {
  readonly authService = inject(AuthService);
  readonly canWrite = computed(() => ['ADMIN', 'SELLER'].includes(this.authService.user()?.role ?? ''));
  route = inject(Router);
  activatedRoute = inject(ActivatedRoute);
  queryClient = inject(QueryClient);

  transferService = inject(TransferService);
  paginationService = inject(PaginationService);
  alertService = inject(AlertService);
  actionModalService = inject(ActionModalService);

  isOpen = signal<boolean>(false);
  openToggle() {
    this.isOpen.update((value) => !value);
  }

  limitPerPage = signal<number>(10);
  limitList = signal<number[]>([10, 20, 50, 100]);

  statusFilter = signal<string>(''); // '' = All
  setStatus(status: string) {
    this.statusFilter.set(status);
  }

  dateFrom = signal<string | null>(null);
  dateTo = signal<string | null>(null);
  setFrom(from: string | null) {
    this.dateFrom.set(from);
  }
  setTo(to: string | null) {
    this.dateTo.set(to);
  }

  onNewLimit(newLimit: number) {
    this.limitPerPage.set(newLimit);
    this.setDefaultLimit();
  }

  transfersQuery = injectQuery(() => ({
    queryKey: [
      'transfers',
      this.limitPerPage(),
      this.paginationService.currentPage(),
      this.statusFilter(),
      this.dateFrom(),
      this.dateTo(),
    ],
    queryFn: () =>
      firstValueFrom(
        this.transferService
          .getTransfers(
            this.paginationService.currentPage(),
            this.limitPerPage(),
            this.statusFilter(),
            this.dateFrom(),
            this.dateTo(),
          )
          .pipe(
            tap(
              (transfer) =>
                transfer.data.length < 1 && this.setDefaultLimit(),
            ),
          ),
      ),
    staleTime: 5000 * 60,
  }));
  titleData = computed(() => ({
    name: 'transferencias',
    count: this.transfersQuery.data()?.meta.total,
  }));

  setDefaultLimit(term?: string) {
    this.route.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { page: 1, query: term },
      queryParamsHandling: 'merge',
    });
  }

  idSelected = computed(() => this.transferService.transferIdSelected());

  transfer = computed(() => {
    return this.transfersQuery
      .data()
      ?.data.find((item) => item.id === this.idSelected());
  });

  transferState = computed(() => this.transfer()?.status);
  transferStatus = TRANSFER_STATUS;
  transferStatusList = transferStatusList;

  modalTitleAction = signal<string>('');
  pendingAction = signal<'cancel' | 'revert'>('cancel');
  openActionModal(title: string, action: 'cancel' | 'revert' = 'cancel') {
    this.modalTitleAction.set(title);
    this.pendingAction.set(action);
  }

  actionEffect = effect(() => {
    if (this.actionModalService.modalState() === 'confirming') {
      this.onActionConfirmed();
    }
  });

  onActionConfirmed(): void {
    if (!this.canWrite() || this.mutationCancel.isPending()) return;
    this.actionModalService.modalState.set('loading');
    const id = this.transferService.transferIdSelected();
    this.mutationCancel.mutate(id);
  }

  mutationCancel = injectMutation(() => ({
    mutationFn: (id: number) =>
      firstValueFrom(this.transferService.cancelTransfer(id)),
    onSuccess: () => {
      this.actionModalService.modalState.set('finished');
      this.transferService.transferIdSelected.set(0);
      this.queryClient.invalidateQueries({ queryKey: ['transfers'] });
      this.queryClient.invalidateQueries({ queryKey: ['products'] });
      this.alertService.showSuccess(
        this.pendingAction() === 'revert'
          ? 'Transferencia revertida con éxito'
          : 'Transferencia cancelada con éxito',
      );
    },
    onError: (exception) => {
      this.actionModalService.modalState.set('finished');
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  deselectTransfer() {
    this.transferService.transferIdSelected.set(0);
  }
  readonly selectedRowNumber = listSelectionNumber(
    this.transferService.transferIdSelected, this.paginationService.currentPage, () => this.transfersQuery.data(),
  );
}