import { TestBed } from '@angular/core/testing';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { SupplyFormModalComponent } from '../supply-form-modal/supply-form-modal.component';
import { TireFormModalComponent } from './tire-form-modal.component';
import { ProductService } from '../../services/product.service';
import { BrandService } from '../../../brands/services/brand.service';
import { ProviderService } from '../../../providers/services/provider.service';
import { CatalogService } from '../../../shared/services/catalog.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import type { Product } from '../../interfaces/product.interface';

describe('Optional tire details', (): void => {
  beforeEach((): void => {
    TestBed.configureTestingModule({imports: [TireFormModalComponent, SupplyFormModalComponent], providers: [
      provideTanStackQuery(new QueryClient()),
      {provide: ProductService, useValue: {getVehicleTypes: () => of([])}},
      {provide: BrandService, useValue: {}}, {provide: ProviderService, useValue: {}},
      {provide: CatalogService, useValue: {getCatalog: () => of([])}},
      {provide: AlertService, useValue: {}},
    ]});
    TestBed.overrideComponent(TireFormModalComponent, {set: {template: '', imports: []}});
    TestBed.overrideComponent(SupplyFormModalComponent, {set: {template: '', imports: []}});
  });
  function product(notes: string | null, providerId: number | null = null): Product {
    return {id: 1, name: 'Llanta', sku: null, type: 'TIRE', purchasePrice: '10', salePrice: '20', stock: 1,
      notes, providerId, brandId: null, createdById: null, updatedById: null,
      createdAt: new Date(), updatedAt: new Date(), deletedAt: null, brand: null, tire: null};
  }
  it('restores the unit label when reopening a prepared product', (): void => {
    const query = TestBed.inject(QueryClient);
    query.setQueryData(['unit-of-measures', ''], [{ id: 59, name: 'Unidad' }]);
    query.setQueryData(['item-types'], [{ id: 1, name: 'Bienes' }]);
    const fixture = TestBed.createComponent(TireFormModalComponent);
    fixture.componentInstance.openForDraft({ unitOfMeasureCatalogId: 59, itemTypeCatalogId: 1 }, 'DUNLOP');
    fixture.detectChanges();
    TestBed.flushEffects();
    expect(fixture.componentInstance.tireForm.controls.unitOfMeasureCatalogId.value).toBe(59);
    expect(fixture.componentInstance.selectedUnitOfMeasure()?.name).toBe('Unidad');
    fixture.destroy();
  });
  it('restores the prepared supply unit without replacing its saved ID with defaults', (): void => {
    const query = TestBed.inject(QueryClient);
    query.setQueryData(['unit-of-measures', ''], [{ id: 59, name: 'Unidad', code: null }]);
    query.setQueryData(['item-types'], [{ id: 1, name: 'Bienes' }]);
    const fixture = TestBed.createComponent(SupplyFormModalComponent);
    fixture.componentInstance.openForDraft({ unitOfMeasureCatalogId: 59, itemTypeCatalogId: 1 }, 'DUNLOP');
    fixture.detectChanges();
    TestBed.flushEffects();
    expect(fixture.componentInstance.supplyForm.controls.unitOfMeasureCatalogId.value).toBe(59);
    expect(fixture.componentInstance.selectedUnitOfMeasure()?.name).toBe('Unidad');
    fixture.destroy();
  });
  it('retains a selected unit across closing and reopening even when absent from current results', (): void => {
    const fixture = TestBed.createComponent(TireFormModalComponent);
    const component = fixture.componentInstance;
    component.openForDraft({}, 'DUNLOP');
    component.setUnitOfMeasure({ id: 59, name: 'Unidad' });
    const savedId = component.tireForm.controls.unitOfMeasureCatalogId.value;
    component.closeModal();
    component.openForDraft({ unitOfMeasureCatalogId: savedId ?? undefined }, 'DUNLOP');
    fixture.detectChanges();
    TestBed.flushEffects();
    expect(component.selectedUnitOfMeasure()?.id).toBe(59);
    expect(component.selectedUnitOfMeasure()?.name).toBe('Unidad');
    fixture.destroy();
  });
  it('requires purchase cost only outside the purchase draft flow', (): void => {
    const tire = TestBed.createComponent(TireFormModalComponent);
    const supply = TestBed.createComponent(SupplyFormModalComponent);
    tire.componentInstance.openForDraft({}, 'DUNLOP');
    supply.componentInstance.openForDraft({}, 'DUNLOP');
    expect(tire.componentInstance.tireForm.controls.purchasePrice.valid).toBeTrue();
    expect(supply.componentInstance.supplyForm.controls.purchasePrice.valid).toBeTrue();
    tire.componentInstance.openForCreate();
    supply.componentInstance.openForCreate();
    expect(tire.componentInstance.tireForm.controls.purchasePrice.hasError('required')).toBeTrue();
    expect(supply.componentInstance.supplyForm.controls.purchasePrice.hasError('required')).toBeTrue();
    tire.destroy(); supply.destroy();
  });
  it('keeps optional details closed for missing required fields and opens them only for an optional error', (): void => {
    const fixture = TestBed.createComponent(TireFormModalComponent);
    const component = fixture.componentInstance;
    component.openForDraft({}, 'DUNLOP');
    component.onSubmit();
    expect(component.tireForm.invalid).toBeTrue();
    expect(component.optionalExpanded()).toBeFalse();
    component.tireForm.controls.loadIndexFront.setValue(-1);
    expect(component.tireForm.controls.loadIndexFront.invalid).toBeTrue();
    component.onSubmit();
    expect(component.optionalExpanded()).toBeTrue();
    fixture.destroy();
  });
  it('starts collapsed for creation even after editing filled data', (): void => {
    const fixture = TestBed.createComponent(TireFormModalComponent);
    fixture.componentInstance.openForEdit(product('Nota'));
    expect(fixture.componentInstance.optionalExpanded()).toBeTrue();
    fixture.componentInstance.openForCreate();
    expect(fixture.componentInstance.optionalExpanded()).toBeFalse();
    fixture.destroy();
  });
  it('opens for a saved note or provider and closes for empty optional data', (): void => {
    const fixture = TestBed.createComponent(TireFormModalComponent);
    const component = fixture.componentInstance;
    component.openForEdit(product(null, 7));
    expect(component.optionalExpanded()).toBeTrue();
    component.openForEdit(product('  '));
    expect(component.optionalExpanded()).toBeFalse();
    expect(component.tireForm.controls.plies.value).toBeNull();
    fixture.destroy();
  });
});
