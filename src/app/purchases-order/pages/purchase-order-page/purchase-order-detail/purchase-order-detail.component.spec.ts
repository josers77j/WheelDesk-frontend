import { ElementRef } from '@angular/core';
import { TireFormModalComponent } from '../../../../products/components/tire-form-modal/tire-form-modal.component';
import { SupplyFormModalComponent } from '../../../../products/components/supply-form-modal/supply-form-modal.component';
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { ProductService } from '../../../../products/services/product.service';
import { ProviderService } from '../../../../providers/services/provider.service';
import { AlertService } from '../../../../shared/components/alert/alert.service';
import { WarehouseService } from '../../../../warehouses/services/warehouse.service';
import { ZoneService } from '../../../../zones/services/zone.service';
import { PurchaseOrderService } from '../../../services/purchase-order.service';
import { PurchaseOrderDetailComponent } from './purchase-order-detail.component';

describe('Purchase order quantity validation', (): void => {
  let component: PurchaseOrderDetailComponent;

  beforeEach((): void => {
    TestBed.configureTestingModule({ providers: [
      provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
      { provide: Location, useValue: {} },
      { provide: Router, useValue: {} },
      { provide: ProviderService, useValue: {} },
      { provide: ZoneService, useValue: {} },
      { provide: WarehouseService, useValue: {} },
      { provide: ProductService, useValue: {} },
      { provide: PurchaseOrderService, useValue: {} },
      { provide: AlertService, useValue: { showSuccess: jasmine.createSpy('showSuccess'), showError: jasmine.createSpy('showError') } },
    ] });
    component = TestBed.runInInjectionContext(() => new PurchaseOrderDetailComponent(TestBed.inject(Location)));
    component.productForm.patchValue({ productId: 1, name: 'Test tire', quantity: 2, unitPrice: '10' });
  });

  for (const quantity of [2.5, 0, -1]) {
    it(`rejects quantity ${quantity} without adding a line or clearing inputs`, (): void => {
      component.productForm.controls.quantity.setValue(quantity);
      component.onSaveProduct();
      expect(component.detailsArray.length).toBe(0);
      expect(component.productForm.controls.quantity.invalid).toBeTrue();
      expect(component.productForm.controls.quantity.touched).toBeTrue();
      expect(component.productForm.getRawValue()).toEqual(jasmine.objectContaining({ quantity, productId: 1, name: 'Test tire', unitPrice: '10' }));
    });
  }

  it('adds a positive integer after correcting a rejected decimal', (): void => {
    component.productForm.controls.quantity.setValue(2.5);
    component.onSaveProduct();
    component.productForm.controls.quantity.setValue(2);
    component.onSaveProduct();
    expect(component.detailsArray.length).toBe(1);
    expect(component.detailsArray.at(0).value).toEqual(jasmine.objectContaining({ quantity: 2, unitPrice: '10', subtotal: '20' }));
  });
  it('selects a newly created product without changing purchase lines, quantity or price', (): void => {
    spyOn(component, 'isEditable').and.returnValue(true);
    const invalidate = spyOn(component.queryClient, 'invalidateQueries').and.callThrough();
    component.purchaseOrderForm.controls.providerId.setValue(8);
    component.onProductCreated({ id: 99, name: 'New supply', type: 'SUPPLY' });
    expect(component.selectedProduct()).toEqual({ id: 99, name: 'New supply' });
    expect(component.productForm.getRawValue()).toEqual(jasmine.objectContaining({ productId: 99, name: 'New supply', quantity: 2, unitPrice: '10' }));
    expect(component.purchaseProductTypeFilter()).toBe('SUPPLY');
    expect(component.detailsArray.length).toBe(0);
    expect(component.purchaseOrderForm.controls.providerId.value).toBe(8);
    expect(invalidate).toHaveBeenCalled();
  });

  it('ignores product creation callbacks for read-only purchases', (): void => {
    spyOn(component, 'isEditable').and.returnValue(false);
    component.onProductCreated({ id: 99, name: 'New tire', type: 'TIRE' });
    expect(component.productForm.controls.productId.value).toBe(1);
    expect(component.selectedProduct()).toBeNull();
  });

  it('keeps an existing purchase line selection when a creation callback arrives', (): void => {
    spyOn(component, 'isEditable').and.returnValue(true);
    component.selectedIndexProduct.set(0);
    component.onProductCreated({ id: 99, name: 'New tire', type: 'TIRE' });
    expect(component.productForm.controls.productId.value).toBe(1);
  });

  it('does not allow services to become purchase products', (): void => {
    spyOn(component, 'isEditable').and.returnValue(true);
    component.onProductCreated({ id: 99, name: 'Service', type: 'SERVICE' });
    expect(component.productForm.controls.productId.value).toBe(1);
  });

  it('opens the existing form for the selected purchase product type', (): void => {
    spyOn(component, 'isEditable').and.returnValue(true);
    const tire = jasmine.createSpyObj<TireFormModalComponent>('tire', ['openForCreate']);
    const supply = jasmine.createSpyObj<SupplyFormModalComponent>('supply', ['openForCreate']);
    spyOn(component, 'tireCreateModal').and.returnValue(tire);
    spyOn(component, 'supplyCreateModal').and.returnValue(supply);
    component.openProductCreate();
    expect(tire.openForCreate).toHaveBeenCalledTimes(1);
    component.setPurchaseProductTypeFilter('SUPPLY');
    component.openProductCreate();
    expect(supply.openForCreate).toHaveBeenCalledTimes(1);
  });

  it('does not open a creation form for read-only purchases', (): void => {
    spyOn(component, 'isEditable').and.returnValue(false);
    const tire = jasmine.createSpyObj<TireFormModalComponent>('tire', ['openForCreate']);
    spyOn(component, 'tireCreateModal').and.returnValue(tire);
    component.openProductCreate();
    expect(tire.openForCreate).not.toHaveBeenCalled();
  });

  it('focuses quantity only after the product dialog is opened', (): void => {
    const dialog = document.createElement('dialog');
    const quantity = document.createElement('input');
    quantity.setAttribute('formControlName', 'quantity');
    dialog.appendChild(quantity);
    const focus = spyOn(quantity, 'focus');
    const show = spyOn(dialog, 'showModal');
    spyOn(component, 'dialog').and.returnValue(new ElementRef(dialog));
    expect(focus).not.toHaveBeenCalled();
    component.openModal();
    expect(show).toHaveBeenCalledOnceWith();
    expect(focus).toHaveBeenCalledOnceWith({ preventScroll: true });
  });

});
