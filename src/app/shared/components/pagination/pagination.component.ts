import { Component, inject, input, computed } from '@angular/core';
import { PaginationService } from './pagination.service';
import {  RouterLink } from "@angular/router";

@Component({
  selector: 'app-pagination',
  imports: [RouterLink],
  templateUrl: './pagination.component.html',
})
export class PaginationComponent {

  currentPage = input<number>(1);
  totalPages = input<number>(0);
  /** Opcionales: si se proveen se muestra "Mostrando X–Y de Z". */
  totalItems = input<number>(0);
  pageSize = input<number>(0);

  paginationService = inject(PaginationService);

  safeCurrent = computed(() => {
    const total = this.totalPages();
    const current = Math.trunc(this.currentPage()) || 1;
    if (!Number.isFinite(total) || total < 1) return 1;
    return Math.min(Math.max(current, 1), total);
  });

  paginationList = computed(() => this.paginationService.buildPagination(this.safeCurrent(), this.totalPages()));

  hasPrevious = computed(() => this.safeCurrent() > 1);
  hasNext = computed(() => {
    const total = this.totalPages();
    return Number.isFinite(total) && total > 1 && this.safeCurrent() < total;
  });

  rangeText = computed(() => {
    const total = this.totalItems();
    const size = this.pageSize();
    if (!total || !size) return null;
    const page = this.safeCurrent();
    const from = (page - 1) * size + 1;
    const to = Math.min(page * size, total);
    if (from > total) return null;
    return `Mostrando ${from}–${to} de ${total}`;
  });

  onPageChange() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
