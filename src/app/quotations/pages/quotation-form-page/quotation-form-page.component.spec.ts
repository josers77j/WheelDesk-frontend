import { fakeAsync, tick, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of, Subject } from 'rxjs';
import { Customer } from '../../../customers/interfaces/customer.interface';
import { CustomerService } from '../../../customers/services/customer.service';
import { ProductService } from '../../../products/services/product.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { QuotationService } from '../../services/quotation.service';
import { QuotationFormPageComponent } from './quotation-form-page.component';

describe('Quotation customer selection regressions', (): void => {
  let component: QuotationFormPageComponent;
  let requests: Map<number, Subject<Customer>>;
  const client = (id: number): Customer => ({ id, name: `Customer ${id}`, address: `Address ${id}`, isTaxPayer: false, email: '', phone: '', customerType: null, districtId: 1, createdById: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null, district: null, taxInfo: null });
  beforeEach((): void => {
    requests = new Map([[1, new Subject<Customer>()], [2, new Subject<Customer>()]]);
    TestBed.configureTestingModule({ providers: [
      provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map(), routeConfig: { path: 'new' } } } },
      { provide: Router, useValue: {} }, { provide: QuotationService, useValue: { preview: (): ReturnType<QuotationService['preview']> => of({ details: [{ subtotal: '10', discountAmount: '0', amountAfterDiscount: '10', taxAmount: '0', unitPrice: '10' }, { subtotal: '20', discountAmount: '0', amountAfterDiscount: '20', taxAmount: '0', unitPrice: '20' }], header: { subtotal: '30', iva: '0', total: '30', globalDiscount: '0' } }) } }, { provide: ProductService, useValue: {} },
      { provide: CustomerService, useValue: { getCustomerById: (id: number): Subject<Customer> => { const request = requests.get(id); if (!request) throw new Error('Unexpected customer'); return request; } } },
      { provide: AlertService, useValue: { showError: jasmine.createSpy('showError') } },
    ] });
    component = TestBed.runInInjectionContext(() => new QuotationFormPageComponent());
  });
  it('keeps recipient data when the active tab is clicked', (): void => {
    component.header.patchValue({ customerName: 'Manual recipient', customerAddress: 'Manual address' });
    component.setMode('EXISTING');
    expect(component.header.getRawValue().customerName).toBe('Manual recipient');
    component.setMode('EXISTING'); component.customerSaved(client(1)); component.setMode('EXISTING');
    expect(component.customerValue()?.id).toBe(1);
    expect(component.header.getRawValue().customerName).toBe('Customer 1');
  });
  it('allows an absent customer in either mode and clearing an existing selection', async (): Promise<void> => {
    expect(component.mode()).toBe('EXISTING');
    expect(component.customerResolved()).toBeTrue();
    expect(component.payload().customerId).toBeNull();
    component.customerSaved(client(1));
    await component.chooseCustomer(null);
    expect(component.customerResolved()).toBeTrue();
    expect(component.payload().customerId).toBeNull();
    expect(component.payload().customerName).toBeNull();
    component.setMode('NEW');
    expect(component.customerResolved()).toBeTrue();
    expect(component.payload().customerId).toBeNull();
  });
  it('does not release loading or save a stale customer response', async (): Promise<void> => {
    component.setMode('EXISTING');
    const first = component.chooseCustomer({ id: 1, name: 'A' });
    const second = component.chooseCustomer({ id: 2, name: 'B' });
    requests.get(1)?.next(client(1)); await first;
    expect(component.customerLoading()).toBeTrue(); expect(component.customerResolved()).toBeFalse();
    requests.get(2)?.next(client(2)); await second;
    expect(component.customerLoading()).toBeFalse(); expect(component.customer()?.id).toBe(2);
  });
  it('clears a failed selection and ignores a response after changing mode', async (): Promise<void> => {
    component.setMode('EXISTING'); const failed = component.chooseCustomer({ id: 2, name: 'B' });
    requests.get(2)?.error(new Error('Failed')); await failed;
    expect(component.customerValue()).toBeNull(); expect(component.customerResolved()).toBeTrue();
    const pending = component.chooseCustomer({ id: 1, name: 'A' }); component.setMode('NEW');
    component.header.patchValue({ customerName: 'Manual' }); requests.get(1)?.next(client(1)); await pending;
    expect(component.customer()).toBeNull(); expect(component.header.getRawValue().customerName).toBe('Manual');
  });
  it('invalidates displayed amounts immediately when the first line is removed', fakeAsync((): void => {
    component.lines.set([{ productId: 1, productName: 'A', quantity: 1, unitPrice: 10 }, { productId: 2, productName: 'B', quantity: 1, unitPrice: 20 }]);
    TestBed.flushEffects(); tick(301); TestBed.flushEffects(); tick(); TestBed.flushEffects();
    expect(component.previewReady()).toBeTrue();
    expect(component.preview.data()?.header.total).toBe('30');
    component.removeItem(0);
    expect(component.lines()[0].productId).toBe(2);
    expect(component.previewCurrent()).toBeFalse(); expect(component.previewReady()).toBeFalse();
  }));
});
