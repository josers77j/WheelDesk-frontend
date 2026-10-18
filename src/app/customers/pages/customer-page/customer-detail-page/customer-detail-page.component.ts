
import { Component, inject, input, OnInit, signal } from '@angular/core';
import {
  Customer,
  CustomerPayload,
  CUSTOMER_TYPE,
  TAX_DOCUMENT_TYPE_CODE,
} from '../../../interfaces/customer.interface';
import { CustomerService } from '../../../services/customer.service';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { Location } from '@angular/common';
import { Router } from '@angular/router';
import {
  QueryClient,
  injectMutation,
  injectQuery,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom, map } from 'rxjs';
import { AlertService } from '../../../../shared/components/alert/alert.service';
import { FormUtils } from '../../../../shared/utils/form-utils';
import { FormErrorLabelComponent } from '../../../../shared/components/form-error-label/form-error-label.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { TaxPayerPipe } from '../../../pipes/tax-payer.pipe';
import { ValueParams } from '../../../../shared/components/combobox/interfaces/search-param.interface';

import { LocalizationService } from '../../../../shared/services/localization.service';
import { ComboboxFormControlComponent } from '../../../../shared/components/combobox-form-control/combobox-form-control.component';
import { CatalogService } from '../../../../shared/services/catalog.service';
import { CatalogItem } from '../../../../shared/services/catalog.service';
import { invalidateCatalogCaches } from '../../../../shared/utils/invalidate-catalog-caches.util';

interface customerUpdateVars {
  id: number;
  customerLike: CustomerPayload;
}

interface CustomerForm {
  name: FormControl<string | null>;
  isTaxPayer: FormControl<boolean | null>;
  email: FormControl<string | null>;
  phone: FormControl<string | null>;
  customerType: FormControl<CUSTOMER_TYPE | null>;
  districtId: FormControl<number | null>;
  address: FormControl<string | null>;
  taxInfo?: FormGroup<TaxInfoForm>;
}

interface TaxInfoForm {
  tradeName: FormControl<string | null>;
  taxDocumentTypeId: FormControl<number | null>;
  taxDocumentNumber: FormControl<string | null>;
  nrc: FormControl<string | null>;
  economicActivityId: FormControl<number | null>;
}
@Component({
  selector: 'app-customer-detail-page',
  imports: [
    ReactiveFormsModule,
    FormErrorLabelComponent,
    AlertComponent,
    TaxPayerPipe,
    ComboboxFormControlComponent,
  ],
  templateUrl: './customer-detail-page.component.html',
})
export class CustomerDetailPageComponent implements OnInit {
  constructor(private readonly location: Location) {}
  customer = input.required<Customer>();

  fb = inject(FormBuilder);
  queryClient = inject(QueryClient);
  localizationService = inject(LocalizationService);

  router = inject(Router);

  // alert state
  wasSave = signal(false);

  // product data if exists
  customerService = inject(CustomerService);
  alertService = inject(AlertService);
  catalogService = inject(CatalogService);

  private originalValue: unknown = null;

  hasChanges() {
    return FormUtils.hasChanges(this.customerForm, this.originalValue);
  }

  formUtils = FormUtils;

  // form
  customerForm: FormGroup<CustomerForm> = this.fb.group({
    name: ['', [Validators.required]],
    isTaxPayer: [false, [Validators.required]],
    email: [
      '',
      [Validators.required, Validators.pattern(this.formUtils.emailPattern)],
    ],
    phone: [
      '',
      [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(8),
        this.formUtils.mustBeANumber,
      ],
    ],
    customerType: [CUSTOMER_TYPE.NATURAL, []],
    districtId: [0, [Validators.required]],
    address: ['', [Validators.required]],
  });

  taxPayerBanner = toSignal(this.customerForm.get('isTaxPayer')!.valueChanges, {
    initialValue: this.customerForm.value.isTaxPayer!,
  });

  ngOnInit() {
    this.setFormValue(this.customer());
  }

  setFormValue(customer: Partial<Customer>): void {
    if (!customer) return;

    this.toggleTaxInfoControl(customer.isTaxPayer ?? false);

    this.customerForm.patchValue({
      name: customer.name ?? '',
      isTaxPayer: customer.isTaxPayer ?? false,
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      customerType: customer.customerType ?? CUSTOMER_TYPE.NATURAL,
      districtId: customer.districtId ?? 0,
      address: customer.address ?? '',
    });

    if (customer.isTaxPayer && this.customerForm.get('taxInfo')) {
      this.customerForm.get('isTaxPayer')?.disable();
      // `patchValue` ignora null/undefined: un contribuyente migrado sin
      // taxInfo deja el grupo como está.
      this.customerForm
        .get('taxInfo')
        ?.patchValue(customer.taxInfo ?? undefined);
    }

    const { district, taxInfo } = customer;

    const economicActivity = taxInfo?.economicActivity;
    this.selectedEconomicActivity.set(
      economicActivity ? { id: economicActivity.id, name: economicActivity.name } : null,
    );
    const municipality = district?.municipality;
    const department = municipality?.department;
    this.selectedDepartment.set(
      department ? { id: department.id, name: department.name } : null,
    );
    this.selectedMunicipality.set(
      municipality ? { id: municipality.id, name: municipality.name } : null,
    );
    this.selectedDistrict.set(district ? { id: district.id, name: district.name } : null);
    this.originalValue = this.customerForm.getRawValue();
  }

  /** NIT (36) and DUI (13) numbers are digits only, so they get the extra check. */
  private isNitOrDuiSelected(): boolean {
    const selectedId = this.customerForm.get('taxInfo.taxDocumentTypeId')?.value;
    const code = this.taxDocumentTypeQuery
      .data()
      ?.find((item) => item.id === selectedId)?.code;

    return (
      code === TAX_DOCUMENT_TYPE_CODE.NIT || code === TAX_DOCUMENT_TYPE_CODE.DUI
    );
  }

  /**
   * Revalidates the document number when the type changes, so switching to
   * NIT/DUI flags an already typed value without waiting for another edit.
   * The `setValue` from the event keeps this independent from the order in
   * which Angular updates the control.
   */
  onTaxDocumentTypeChange(event: Event) {
    const taxDocumentTypeId = Number((event.target as HTMLSelectElement).value);
    const typeControl = this.customerForm.get('taxInfo.taxDocumentTypeId');
    typeControl?.setValue(taxDocumentTypeId);
    typeControl?.markAsDirty();
    this.customerForm
      .get('taxInfo.taxDocumentNumber')
      ?.updateValueAndValidity({ emitEvent: false });
  }

  toggleTaxInfoControl(isTaxPayer: boolean) {
    if (isTaxPayer && !this.customerForm.get('taxInfo')) {
      this.customerForm.addControl(
        'taxInfo',
        this.fb.group<TaxInfoForm>({
          tradeName: this.fb.control(null, Validators.required),
          taxDocumentTypeId: this.fb.control(null, Validators.required),
          taxDocumentNumber: this.fb.control(null, [
            Validators.required,
            this.formUtils.digitsOnlyIf(() => this.isNitOrDuiSelected()),
          ]),
          nrc: this.fb.control(null, [
            Validators.required,
            this.formUtils.mustBeANumber,
          ]),
          economicActivityId: this.fb.control(null, Validators.required),
        }),
      );
    }

    if (!isTaxPayer && this.customerForm.get('taxInfo')) {
      this.customerForm.removeControl('taxInfo');
    }
  }

  onSubmit(): void {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    const isDirty = this.hasChanges();

    this.customerForm.markAllAsTouched();

    const isValid = this.customerForm.valid;

    if (!isValid) return;

    if (!isDirty) {
      this.isLoading.set(false);
      return;
    }

    const id = this.customer().id;

    const {
      name,
      email,
      phone,
      districtId,
      address,
      customerType,
      isTaxPayer,
    } = this.customerForm.getRawValue();

    const taxInfoData = this.customerForm.get('taxInfo')?.value;

    const customerLike: CustomerPayload = {
      name: name!,
      email: email!,
      phone: phone!,
      districtId: districtId!,
      address: address!,
      customerType: customerType!,
      isTaxPayer: isTaxPayer!,
    };

    if (isTaxPayer && taxInfoData) {
      customerLike.taxInfo = {
        tradeName: taxInfoData.tradeName!,
        nrc: taxInfoData.nrc!,
        taxDocumentTypeId: taxInfoData.taxDocumentTypeId!,
        economicActivityId: taxInfoData.economicActivityId!,
        taxDocumentNumber: taxInfoData.taxDocumentNumber!,
      };
    }

    if (id === 0) {
      this.mutationCreate.mutate(customerLike);
    } else {
      this.mutationUpdate.mutate({
        id,
        customerLike,
      });
    }
  }

  mutationCreate = injectMutation(() => ({
    mutationFn: (customerLike: CustomerPayload) =>
      firstValueFrom(this.customerService.createCustomer(customerLike)),
    onSuccess: () => {
      this.queryClient.invalidateQueries({ queryKey: ['customers'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Cliente creado con éxito');
      this.isLoading.set(false);
      this.router.navigate(['/customers']);
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  // UPDATE METHOD
  mutationUpdate = injectMutation(() => ({
    mutationFn: ({ id, customerLike }: customerUpdateVars) =>
      firstValueFrom(this.customerService.updateCustomer(id, customerLike)),
    onSuccess: () => {
      this.queryClient.invalidateQueries({ queryKey: ['customers'] });
      invalidateCatalogCaches(this.queryClient);
      this.isLoading.set(false);
      this.customerForm.get('isTaxPayer')?.disable();
       this.alertService.showSuccess('Cliente actualizado con éxito');
       this.originalValue = this.customerForm.getRawValue();
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  isLoading = signal<boolean>(false);

  backToPreviusPage() {
    this.location.back();
  }

  // District Section
  selectedDistrict = signal<ValueParams | null>(null);

  setDistrict(district: ValueParams | null) {
    this.customerForm.get('districtId')?.setValue(district?.id ?? null);
    this.selectedDistrict.set(district);
    this.customerForm.get('taxInfo.economicActivityId')?.markAsDirty();
  }

  onDistrictChange(event: Event) {
    const id = Number((event.target as HTMLSelectElement).value);
    this.setDistrict(
      this.districtsQuery.data()?.find((district) => district.id === id) ?? null,
    );
  }

  districtsQuery = injectQuery(() => {
    const municipality = this.selectedMunicipality();
    return {
      queryKey: ['district-select', municipality?.id ?? null],
      queryFn: (): Promise<ValueParams[]> => {
        if (!municipality) {
          throw new Error('Selecciona un municipio para consultar sus distritos.');
        }
        return firstValueFrom(this.localizationService.getDistrict('', municipality.id));
      },
      staleTime: 5000 * 60,
      enabled: !!municipality,
    };
  });

  districtTouched() {
    this.customerForm.get('districtId')?.setValue(null);
    this.customerForm.get('districtId')?.markAsTouched();
    this.selectedDistrict.set(null);
  }

  // Municipality Section
  selectedMunicipality = signal<ValueParams | null>(null);

  setMunicipality(municipality: ValueParams | null) {
    this.districtTouched();

    this.selectedMunicipality.set(municipality);
  }

  onMunicipalityChange(event: Event) {
    const id = Number((event.target as HTMLSelectElement).value);
    this.setMunicipality(
      this.municipalitiesQuery.data()?.find((municipality) => municipality.id === id) ??
        null,
    );
  }
  municipalitiesQuery = injectQuery(() => {
    const department = this.selectedDepartment();
    return {
      queryKey: ['municipality-select', department?.id ?? null],
      queryFn: (): Promise<ValueParams[]> => {
        if (!department) {
          throw new Error('Selecciona un departamento para consultar sus municipios.');
        }
        return firstValueFrom(this.localizationService.getMunicipality('', department.id));
      },
      staleTime: 5000 * 60,
      enabled: !!department,
    };
  });

  // Department Section
  selectedDepartment = signal<ValueParams | null>(null);

  setDepartment(department: ValueParams | null) {
    this.districtTouched();
    this.selectedMunicipality.set(null);
    this.selectedDepartment.set(department);
  }

  onDepartmentChange(event: Event) {
    const id = Number((event.target as HTMLSelectElement).value);
    this.setDepartment(
      this.deparmentsQuery.data()?.find((department) => department.id === id) ??
        null,
    );
  }

  deparmentsQuery = injectQuery(() => ({
    queryKey: ['department-select'],
    queryFn: () => firstValueFrom(this.localizationService.getDepartment('')),
    staleTime: 5000 * 60,
  }));

  selectedEconomicActivity = signal<ValueParams | null>(null);

  taxDocumentTypeQuery = injectQuery(() => ({
    queryKey: [
      'documenty-type-combobox',
      this.economicActivityComboboxOutput(),
    ],

    queryFn: () =>
      firstValueFrom(this.catalogService.getCatalog('tax-document-type')),
    staleTime: 5000 * 60,
  }));

  setEconomicActivity(economicActivity: ValueParams | null) {
    this.customerForm
      .get('taxInfo.economicActivityId')
      ?.setValue(economicActivity?.id);
    this.customerForm.get('taxInfo.economicActivityId')?.markAsDirty();
    this.selectedEconomicActivity.set(economicActivity);
  }

  economicActivityComboboxOutput = signal<string>('');
  /** Perezoso: pide al interactuar con su combobox. */
  econTouched = signal(false);

  economicActivityQuery = injectQuery(() => ({
    queryKey: [
      'economic-activity-combobox',
      this.economicActivityComboboxOutput(),
    ],

    queryFn: () =>
      firstValueFrom(
        this.catalogService
          .getCatalog(
            'economic-activity',
            this.economicActivityComboboxOutput(),
          )
          .pipe(
            map((economicActivity) =>
              this.mapEconomicActivity(economicActivity),
            ),
          ),
      ),
    staleTime: 5000 * 60,
    enabled: this.econTouched(),
  }));

  mapEconomicActivity(economicActivity: CatalogItem[]) {
    return economicActivity.map((item) => ({
      id: item.id,
      name: item.name,
    }));
  }
}
