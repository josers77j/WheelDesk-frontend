import { FilterPanelComponent } from '../../../shared/components/filter-panel/filter-panel.component';
import { auditActorName } from '../../utils/audit-actor-name';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { AuditService } from '../../services/audit.service';
import {
  AUDIT_ACTIONS,
  type AuditSearchParams,
} from '../../interfaces/audit.interface';
import { TitleComponent } from '../../../shared/components/title/title.component';
import { DateRangeComponent } from '../../../shared/components/date-range/date-range.component';
import { LimitComponent } from '../../../shared/components/limit/limit.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { PaginationService } from '../../../shared/components/pagination/pagination.service';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { QueryErrorComponent } from '../../../shared/components/query-error/query-error.component';

@Component({
  selector: 'app-audit-page',
  imports: [
    FilterPanelComponent,
    FormsModule,
    TitleComponent,
    DateRangeComponent,
    LimitComponent,
    PaginationComponent,
    SkeletonComponent,
    QueryErrorComponent,
  ],
  templateUrl: './audit-page.component.html',
})
export class AuditPageComponent {
  private readonly auditService = inject(AuditService);
  private readonly paginationService = inject(PaginationService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly actions = AUDIT_ACTIONS;
  readonly actorName = auditActorName;
  readonly entities = [
    'sale-order',
    'purchase-order',
    'customer',
    'transfer',
    'quotation',
    'migration-batch',
    'contingency',
    'contingency-lote',
    'product',
    'report',
    'user',
  ];

  isOpen = signal<boolean>(false);
  limitPerPage = signal<number>(10);
  searchParams = signal<Omit<AuditSearchParams, 'page' | 'limit'>>({});
  formSearchParams = signal<Omit<AuditSearchParams, 'page' | 'limit'>>({});

  auditQuery = injectQuery(() => ({
    queryKey: [
      'audit',
      this.paginationService.currentPage(),
      this.limitPerPage(),
      this.searchParams(),
    ],
    queryFn: () =>
      firstValueFrom(
        this.auditService.getLogs({
          ...this.searchParams(),
          page: this.paginationService.currentPage(),
          limit: this.limitPerPage(),
        }),
      ),
  }));

  setAction(value: string) {
    this.formSearchParams.update((p) => ({ ...p, action: value || undefined }));
  }

  setEntityType(value: string) {
    this.formSearchParams.update((p) => ({ ...p, entityType: value || undefined }));
  }

  setEntityId(value: string) {
    this.formSearchParams.update((p) => ({ ...p, entityId: value || undefined }));
  }

  setFrom(value: string) {
    this.formSearchParams.update((p) => ({ ...p, from: value || undefined }));
  }

  setTo(value: string) {
    this.formSearchParams.update((p) => ({ ...p, to: value || undefined }));
  }

  onSearch(): void {
    if (this.auditQuery.isFetching()) return;
    this.searchParams.set({ ...this.formSearchParams() });
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { page: 1 },
      queryParamsHandling: 'merge',
    });
  }

  onResetFilters(): void {
    if (this.auditQuery.isFetching()) return;
    this.formSearchParams.set({});
    this.searchParams.set({});
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { page: 1 },
      queryParamsHandling: 'merge',
    });
  }

  onLimitChange(newLimit: number) {
    this.limitPerPage.set(newLimit);
  }
}
