import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  provideTanStackQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { CatalogService } from '../../../shared/services/catalog.service';
import { LocalizationService } from '../../../shared/services/localization.service';
import { CustomerFormModalComponent } from './customer-form-modal.component';
import { CustomerService, emptyCustomer } from '../../services/customer.service';

describe('CustomerFormModal taxpayer creation context', () => {
  let component: CustomerFormModalComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CustomerFormModalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTanStackQuery(
          new QueryClient({ defaultOptions: { queries: { retry: false } } }),
        ),
        { provide: CatalogService, useValue: { getCatalog: () => of([]) } },
        {
          provide: LocalizationService,
          useValue: {
            getDepartment: () => of([]),
            getMunicipality: () => of([]),
            getDistrict: () => of([]),
          },
        },
      ],
    });
    // Only the form state is exercised; no modal DOM or catalog server is needed.
    component = TestBed.runInInjectionContext(
      () => new CustomerFormModalComponent(),
    );
  });

  function toggle(checked: boolean): void {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', (event: Event): void =>
      component.onTaxPayerToggle(event),
    );
    input.dispatchEvent(new Event('change'));
  }

  it('requires and locks taxpayer data for tax-credit creation, including the disabled value in payload', () => {
    component.openForCreate(true);
    expect(component.isTaxPayerOn()).toBeTrue();
    expect(component.customerForm.controls.isTaxPayer.disabled).toBeTrue();
    expect(component.customerForm.getRawValue().isTaxPayer).toBeTrue();
    expect(component.customerForm.controls.taxInfo).toBeDefined();
    toggle(false);
    expect(component.isTaxPayerOn()).toBeTrue();
    expect(component.customerForm.getRawValue().isTaxPayer).toBeTrue();
  });

  it('clears fiscal data and unlocks the toggle when the next creation is consumer-final', () => {
    component.openForCreate(true);
    component.customerForm.controls.taxInfo?.controls.tradeName.setValue(
      'Old fiscal draft',
    );
    component.openForCreate(false);
    expect(component.isTaxPayerOn()).toBeFalse();
    expect(component.taxPayerRequired()).toBeFalse();
    expect(component.customerForm.controls.isTaxPayer.enabled).toBeTrue();
    expect(component.customerForm.controls.taxInfo).toBeUndefined();
    expect(component.customerForm.controls.email.valid).toBeTrue();
    toggle(true);
    expect(component.isTaxPayerOn()).toBeTrue();
    expect(
      component.customerForm.controls.taxInfo?.controls.tradeName.value,
    ).toBe('');
    toggle(false);
    expect(component.isTaxPayerOn()).toBeFalse();
  });

  it('does not leak the required context after closing into generic customer creation', () => {
    component.openForCreate(true);
    component.closeModal();
    component.openForCreate();
    expect(component.taxPayerRequired()).toBeFalse();
    expect(component.customerForm.getRawValue().isTaxPayer).toBeFalse();
    expect(component.customerForm.controls.isTaxPayer.enabled).toBeTrue();
  });

  it('reapplies the required context after repeatedly alternating document types', () => {
    for (const required of [true, false, true, false]) {
      component.openForCreate(required);
      expect(component.isTaxPayerOn()).toBe(required);
      expect(component.customerForm.controls.isTaxPayer.disabled).toBe(
        required,
      );
      expect(component.customerForm.getRawValue().isTaxPayer).toBe(required);
    }
  });
  it('preserves empty optional fields in consumer-final creation without fiscal data', async (): Promise<void> => {
    component.openForCreate(false);
    component.customerForm.controls.name.setValue('QA Customer');
    const create = spyOn(TestBed.inject(CustomerService), 'createCustomer').and.returnValue(of(emptyCustomer));
    component.onSubmit();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(create).toHaveBeenCalledOnceWith({
      name: 'QA Customer',
      isTaxPayer: false,
      email: undefined,
      phone: null,
      customerType: null,
      districtId: null,
      address: undefined,
    });
  });

  it('sends null for cleared optional fields while omitting untouched edit fields', async (): Promise<void> => {
    component.openForEdit({
      ...emptyCustomer,
      id: 7,
      name: 'QA Customer',
      phone: '+50371234567',
      districtId: 12,
      taxInfo: null,
    });
    component.customerForm.controls.phone.setValue('');
    component.customerForm.controls.phone.markAsDirty();
    component.customerForm.controls.districtId.setValue(null);
    component.customerForm.controls.districtId.markAsDirty();
    const update = spyOn(TestBed.inject(CustomerService), 'updateCustomer').and.returnValue(of(emptyCustomer));
    component.onSubmit();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(update).toHaveBeenCalledOnceWith(7, { phone: null, districtId: null });
  });
  it('does not request dependent locations when no parent is selected', async (): Promise<void> => {
    const localization = TestBed.inject(LocalizationService);
    const municipalities = spyOn(localization, 'getMunicipality').and.returnValue(of([]));
    const districts = spyOn(localization, 'getDistrict').and.returnValue(of([]));
    await component.municipalitiesQuery.refetch();
    await component.districtsQuery.refetch();
    expect(municipalities).not.toHaveBeenCalled();
    expect(districts).not.toHaveBeenCalled();
  });

  it('does not retain a selected economic activity when fiscal data is absent', (): void => {
    component.selectedEconomicActivity.set({ id: 99, name: 'Previous activity' });
    component.setFormValue({ ...emptyCustomer, isTaxPayer: true, taxInfo: null });
    expect(component.selectedEconomicActivity()).toBeNull();
  });

});
