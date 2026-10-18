import { CommonModule, Location } from '@angular/common';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { CustomerService } from '../../../../customers/services/customer.service';
import { ProductService } from '../../../../products/services/product.service';
import { QuotationService } from '../../../../quotations/services/quotation.service';
import { AlertService } from '../../../../shared/components/alert/alert.service';
import { DeleteActionModalService } from '../../../../shared/components/delete-action-modal/deleteActionModal.service';
import { WarehouseService } from '../../../../warehouses/services/warehouse.service';
import { ZoneService } from '../../../../zones/services/zone.service';
import { CatalogService } from '../../../services/catalog.service';
import { CheckoutDraftService } from '../../../services/checkout-draft.service';
import { SaleOrderService } from '../../../services/sale-order.service';
import { SaleOrderCheckoutComponent } from './sale-order-checkout.component';

describe('Checkout payment row identity', (): void => {
  let fixture: ComponentFixture<SaleOrderCheckoutComponent>;
  let component: SaleOrderCheckoutComponent;
  let error: jasmine.Spy;
  beforeEach(async (): Promise<void> => {
    localStorage.removeItem('workshop.sale-order.draft');
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queries.setQueryData(['catalog', 'payment-methode'], [
      { id: 1, code: '01', name: 'Billetes y monedas' },
      { id: 2, code: '03', name: 'Tarjeta de débito' },
    ]);
    error = jasmine.createSpy('showError');
    TestBed.configureTestingModule({ imports: [SaleOrderCheckoutComponent], providers: [
      provideTanStackQuery(queries),
      { provide: Location, useValue: {} }, { provide: Router, useValue: {} },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      { provide: QuotationService, useValue: {} }, { provide: SaleOrderService, useValue: {} },
      { provide: CatalogService, useValue: { getCatalog: (): ReturnType<CatalogService['getCatalog']> => of([]) } },
      { provide: CustomerService, useValue: {} }, { provide: ProductService, useValue: {} },
      { provide: ZoneService, useValue: {} }, { provide: WarehouseService, useValue: {} },
      DeleteActionModalService, { provide: AlertService, useValue: { showError: error } },
    ] }).overrideComponent(SaleOrderCheckoutComponent, { set: {
      imports: [CommonModule, FormsModule, ReactiveFormsModule], schemas: [NO_ERRORS_SCHEMA],
    } });
    fixture = TestBed.createComponent(SaleOrderCheckoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    const fb = TestBed.inject(FormBuilder);
    component.documentTypeId.set(1);
    component.itemsArray.push(fb.group({ productId: 1, name: 'Producto', quantity: 1, zoneId: 1, zoneName: 'Zona', unitPrice: 30, unitPriceEstimate: '30', lineTotal: '30', discountType: null, discountValue: null }));
    component.onAddPayment();
    component.onAddPayment();
    fixture.detectChanges();
    setAmount(1, 30);
    const select = paymentSelects()[1];
    select.selectedIndex = 2;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  });
  afterEach((): void => { fixture.destroy(); localStorage.removeItem('workshop.sale-order.draft'); });
  function host(): HTMLElement {
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement)) throw new Error('Expected checkout host');
    return element;
  }
  function paymentSelects(): HTMLSelectElement[] {
    return Array.from(host().querySelectorAll<HTMLSelectElement>('[formArrayName="payments"] select'));
  }
  function setAmount(index: number, amount: number): void {
    const input = host().querySelectorAll<HTMLInputElement>('[formArrayName="payments"] input')[index];
    input.value = String(amount);
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  function removeFirst(): void {
    host().querySelector<HTMLButtonElement>('[aria-label="Quitar pago"]')?.click();
    fixture.detectChanges();
  }
  it('preserves the next selected method and keeps listening to its amount after deleting cash', (): void => {
    expect(component.paymentsTotal()).toBe('60');
    removeFirst();
    expect(component.paymentsArray.at(0).value.paymentMethodId).toBe(2);
    expect(paymentSelects()[0].selectedOptions[0].textContent).toContain('Tarjeta');
    setAmount(0, 20);
    expect(component.paymentsArray.at(0).value.amount).toBe(20);
    expect(component.paymentsTotal()).toBe('20');
    const summary = Array.from(host().querySelectorAll('span')).find(span => span.textContent?.trim() === 'Pagos registrados')?.parentElement;
    expect(summary?.textContent).toContain('20.00');
    expect(component.nonCashTotal()).toBe('20');
    expect(TestBed.inject(CheckoutDraftService).draft().payments[0].amount).toBe(20);
  });
  it('rejects a short or excessive card payment after removing the first row', async (): Promise<void> => {
    removeFirst();
    setAmount(0, 31);
    await component.onSubmit();
    expect(error).toHaveBeenCalledWith(jasmine.stringContaining('deben ser exactos'));
    error.calls.reset();
    setAmount(0, 29);
    await component.onSubmit();
    expect(error).toHaveBeenCalledWith('Los pagos no cubren el total estimado');
  });
  it('accepts an exact card payment and preserves its method when the amount changes', async (): Promise<void> => {
    removeFirst();
    setAmount(0, 30);
    await component.onSubmit();
    expect(error).not.toHaveBeenCalled();
    expect(component.reviewItems().find(item => item.label === 'Pagos')?.complete).toBeTrue();
    expect(component.paymentsArray.at(0).value.paymentMethodId).toBe(2);
  });
  it('defaults only a blank surviving method to cash without replacing its amount', (): void => {
    component.paymentsArray.at(1).get('paymentMethodId')?.setValue(null);
    setAmount(1, 12);
    removeFirst();
    expect(component.paymentsArray.at(0).value.paymentMethodId).toBe(1);
    expect(component.paymentsTotal()).toBe('12');
    expect(component.cashTotal()).toBe('12');
  });
  it('keeps the last row connected after removing a middle row', (): void => {
    component.onAddPayment();
    fixture.detectChanges();
    setAmount(2, 7);
    component.onDeletePayment(1);
    fixture.detectChanges();
    setAmount(1, 9);
    expect(component.paymentsArray.at(1).value.amount).toBe(9);
    expect(component.paymentsTotal()).toBe('39');
  });
  it('restores first-payment defaults after all rows have been removed', (): void => {
    removeFirst();
    removeFirst();
    expect(component.paymentsTotal()).toBe('0');
    component.onAddPayment();
    fixture.detectChanges();
    expect(component.paymentsArray.at(0).value.paymentMethodId).toBe(1);
    expect(component.paymentsTotal()).toBe('30');
    setAmount(0, 35);
    expect(component.cashTotal()).toBe('35');
    expect(component.changeTotal()).toBe('5');
  });

  it('allows submitting an incomplete sale to explain the missing payment method', (): void => {
    component.paymentsArray.at(0).patchValue({ paymentMethodId: null });
    fixture.detectChanges();
    const submit = host().querySelector<HTMLButtonElement>('button[type="submit"].btn-primary');
    expect(submit?.disabled).toBeFalse();
    submit?.click();
    fixture.detectChanges();
    expect(error).toHaveBeenCalledWith('Revisa los pagos: cada uno debe tener un método de pago y un monto mayor que cero.');
    expect(host().querySelector('[formArrayName="payments"] select')?.classList.contains('select-error')).toBeTrue();
  });

  it('shows warehouse guidance inside the item modal and updates it when the warehouse is chosen', (): void => {
    component.itemForm.controls.productId.setValue(1);
    component.selectedProduct.set({ id: 1, name: 'Producto' });
    fixture.detectChanges();
    const submit = host().querySelector<HTMLButtonElement>('dialog button[type="submit"].btn-success');
    expect(submit?.disabled).toBeFalse();
    submit?.click();
    fixture.detectChanges();
    const alert = host().querySelector('dialog .alert-error');
    expect(alert?.textContent).toContain('Selecciona una bodega y después la zona de salida del producto.');
    component.setWarehouse({ id: 2, name: 'Bodega' });
    fixture.detectChanges();
    expect(host().querySelector('dialog .alert-error')?.textContent).toContain('Selecciona la zona de salida del producto.');
    component.setItemZone({ id: 3, name: 'Zona' });
    fixture.detectChanges();
    expect(host().querySelector('dialog .alert-error')).toBeNull();
  });

});
