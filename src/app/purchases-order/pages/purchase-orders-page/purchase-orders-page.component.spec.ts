import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { PurchaseOrdersPageComponent } from './purchase-orders-page.component';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import { ProviderService } from '../../../providers/services/provider.service';
import { PaginationService } from '../../../shared/components/pagination/pagination.service';
import { AlertService } from '../../../shared/components/alert/alert.service';

describe('Purchase document selection across searches', (): void => {
  const currentPage = signal(1);
  const alerts = { showWarning: jasmine.createSpy('warning'), showError: jasmine.createSpy('error'), showSuccess: jasmine.createSpy('success') };
  let component: PurchaseOrdersPageComponent;
  beforeEach((): void => {
    currentPage.set(1); alerts.showWarning.calls.reset();
    const params = convertToParamMap({});
    TestBed.configureTestingModule({ imports: [PurchaseOrdersPageComponent], providers: [
      provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: params }, queryParamMap: of(params) } },
      { provide: Router, useValue: { navigate: jasmine.createSpy('navigate').and.resolveTo(true) } },
      { provide: PurchaseOrderService, useValue: { selectedPurchaseOrderId: signal(0), getPurchaseOrders: () => of({ data: [], meta: { page: 1, total: 0, totalPages: 0, limit: 10 } }) } },
      { provide: ProviderService, useValue: {} },
      { provide: PaginationService, useValue: { currentPage } },
      { provide: AlertService, useValue: alerts },
    ] });
    TestBed.overrideComponent(PurchaseOrdersPageComponent, { set: { template: '', imports: [] } });
    component = TestBed.createComponent(PurchaseOrdersPageComponent).componentInstance;
    TestBed.flushEffects();
  });
  it('retains earlier purchases when changing supplier, page and page size', (): void => {
    component.toggleDocumentSelection(1);
    component.appliedSearchParams.set({ providerId: 2 });
    currentPage.set(2); component.limitPerPage.set(20);
    TestBed.flushEffects();
    component.toggleDocumentSelection(2);
    expect(component.documentSelection()).toEqual([1, 2]);
    component.updateDocumentSelection([2]);
    expect(component.documentSelection()).toEqual([2]);
  });
  it('keeps the selection bounded and permits toggling an already selected order off', (): void => {
    for (let id = 1; id <= 21; id++) component.toggleDocumentSelection(id);
    expect(component.documentSelection().length).toBe(20);
    expect(alerts.showWarning).toHaveBeenCalledTimes(1);
    component.toggleDocumentSelection(1);
    expect(component.documentSelection()).not.toContain(1);
  });
  it('uses the same field for an order number or a complete invoice code', (): void => {
    component.setDocumentNumber('ABC-123');
    expect(component.formSearchParams().documentNumber).toBe('ABC-123');
    component.clearDocumentNumber();
    expect(component.formSearchParams().documentNumber).toBe('');
    component.setDocumentNumber('10');
    expect(component.formSearchParams().documentNumber).toBe('10');
  });
});
