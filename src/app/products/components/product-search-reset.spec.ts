import { TestBed } from '@angular/core/testing';
import {
  provideTanStackQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { TireFormModalComponent } from './tire-form-modal/tire-form-modal.component';
import { SupplyFormModalComponent } from './supply-form-modal/supply-form-modal.component';
import { ProductService } from '../services/product.service';
import { BrandService } from '../../brands/services/brand.service';
import { ProviderService } from '../../providers/services/provider.service';
import { CatalogService } from '../../shared/services/catalog.service';
import { AlertService } from '../../shared/components/alert/alert.service';

describe('Product modal search reset', () => {
  let brands: jasmine.SpyObj<BrandService>;
  let providers: jasmine.SpyObj<ProviderService>;
  beforeEach(() => {
    brands = jasmine.createSpyObj<BrandService>('brands', ['getBrandByName']);
    brands.getBrandByName.and.returnValue(of([]));
    providers = jasmine.createSpyObj<ProviderService>('providers', [
      'getProviderByName',
    ]);
    providers.getProviderByName.and.returnValue(of([]));
    TestBed.configureTestingModule({
      imports: [TireFormModalComponent, SupplyFormModalComponent],
      providers: [
        provideTanStackQuery(
          new QueryClient({ defaultOptions: { queries: { retry: false } } }),
        ),
        {
          provide: ProductService,
          useValue: { getVehicleTypes: () => of([]) },
        },
        { provide: BrandService, useValue: brands },
        { provide: ProviderService, useValue: providers },
        { provide: CatalogService, useValue: { getCatalog: () => of([]) } },
        { provide: AlertService, useValue: {} },
      ],
    });
    TestBed.overrideComponent(TireFormModalComponent, {
      set: { template: '', imports: [] },
    });
    TestBed.overrideComponent(SupplyFormModalComponent, {
      set: { template: '', imports: [] },
    });
  });
  function previousSearch(
    component: TireFormModalComponent | SupplyFormModalComponent,
  ): void {
    component.brandComboboxOutput.set('Dunlop');
    component.providerComboboxOutput.set('Proveedor anterior');
    component.brandTouched.set(true);
    component.providerTouched.set(true);
    component.unitTouched.set(true);
  }
  function expectReset(
    component: TireFormModalComponent | SupplyFormModalComponent,
  ): void {
    expect(component.brandComboboxOutput()).toBe('');
    expect(component.providerComboboxOutput()).toBe('');
    expect(component.brandTouched()).toBeFalse();
    expect(component.providerTouched()).toBeFalse();
    expect(component.unitTouched()).toBeFalse();
    expect(component.selectedBrand()).toBeNull();
    expect(component.selectedProvider()).toBeNull();
  }
  it('reopens tire creation with an unfiltered search and fetches only on interaction', () => {
    const fixture = TestBed.createComponent(TireFormModalComponent),
      component = fixture.componentInstance;
    previousSearch(component);
    component.unitOfMeasureComboboxOutput.set('Litro');
    component.closeModal();
    component.openForCreate();
    fixture.detectChanges();
    expectReset(component);
    expect(component.unitOfMeasureComboboxOutput()).toBe('');
    expect(brands.getBrandByName).not.toHaveBeenCalled();
    expect(providers.getProviderByName).not.toHaveBeenCalled();
    component.brandTouched.set(true);
    fixture.detectChanges();
    expect(brands.getBrandByName).toHaveBeenCalledWith(component.limit, '');
  });
  it('reopens supply creation without the previous brand/provider/unit filters', () => {
    const fixture = TestBed.createComponent(SupplyFormModalComponent),
      component = fixture.componentInstance;
    previousSearch(component);
    component.unitSearch.set('Kilogramo');
    component.closeModal();
    component.openForCreate();
    fixture.detectChanges();
    expectReset(component);
    expect(component.unitSearch()).toBe('');
    expect(brands.getBrandByName).not.toHaveBeenCalled();
    expect(providers.getProviderByName).not.toHaveBeenCalled();
    component.providerTouched.set(true);
    fixture.detectChanges();
    expect(providers.getProviderByName).toHaveBeenCalledWith(
      component.limit,
      '',
    );
  });
});
