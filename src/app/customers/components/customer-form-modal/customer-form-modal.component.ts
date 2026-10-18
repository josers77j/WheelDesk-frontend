import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  QueryClient,
  injectMutation,
  injectQuery,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom, map } from 'rxjs';

import { AlertService } from '../../../shared/components/alert/alert.service';
import { ComboboxFormControlComponent } from '../../../shared/components/combobox-form-control/combobox-form-control.component';
import { ValueParams } from '../../../shared/components/combobox/interfaces/search-param.interface';
import { FormErrorLabelComponent } from '../../../shared/components/form-error-label/form-error-label.component';
import { CatalogItem } from '../../../shared/services/catalog.service';
import { CatalogService } from '../../../shared/services/catalog.service';
import { LocalizationService } from '../../../shared/services/localization.service';
import { FormUtils } from '../../../shared/utils/form-utils';
import { PhoneInputComponent } from '../../../shared/components/phone-input/phone-input.component';
import {
  CUSTOMER_TYPE,
  Customer,
  CustomerPayload,
  TAX_DOCUMENT_TYPE_CODE,
  TaxInfo,
} from '../../interfaces/customer.interface';
import { CustomerService } from '../../services/customer.service';
import { invalidateCatalogCaches } from '../../../shared/utils/invalidate-catalog-caches.util';

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

const BASE_REQUIRED_IF_TAXPAYER = [
  'email',
  'phone',
  'customerType',
  'districtId',
  'address',
];

@Component({
  selector: 'app-customer-form-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormErrorLabelComponent,
    ComboboxFormControlComponent,
    PhoneInputComponent,
  ],
  templateUrl: './customer-form-modal.component.html',
})
export class CustomerFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly customerService = inject(CustomerService);
  private readonly localizationService = inject(LocalizationService);
  private readonly catalogService = inject(CatalogService);
  private readonly alertService = inject(AlertService);
  private readonly queryClient = inject(QueryClient);

  @ViewChild('formModal') formModal!: ElementRef<HTMLDialogElement>;

  saved = output<Customer>();

  customerId = signal<number>(0);
  isEditing = computed(() => this.customerId() > 0);
  isSubmitting = signal<boolean>(false);

  // Wizard: paso 1 = datos base, paso 2 = info fiscal (solo si isTaxPayer)
  currentStep = signal<1 | 2>(1);
  isTaxPayerOn = signal<boolean>(false);
  readonly taxPayerRequired = signal(false);
  /**
   * Caché de la info fiscal DURANTE la sesión del modal: taxInfo es info
   * adicional que solo se oculta al desmarcar isTaxPayer (no se destruye),
   * de modo que al volver a marcar el toggle los datos previos se restauran.
   */
  private taxInfoCache = signal<null | {
    tradeName: string | null;
    taxDocumentTypeId: number | null;
    taxDocumentNumber: string | null;
    nrc: string | null;
    economicActivityId: number | null;
  }>(null);

  /**
   * Snapshot del taxInfo que viene del backend al abrir el modal.
   * Fuente de verdad para restaurar los datos fiscales reales del cliente
   * cuando el usuario desmarca y vuelve a marcar isTaxPayer.
   */
  private editTaxInfoSnapshot = signal<TaxInfo | null>(null);

  formUtils = FormUtils;
  customerType = CUSTOMER_TYPE;

  customerForm: FormGroup<CustomerForm> = this.fb.group({
    name: ['', [Validators.required]],
    isTaxPayer: [false],
    email: ['', [Validators.pattern(this.formUtils.emailPattern)]],
    phone: ['', [FormUtils.phoneValidator()]],
    customerType: [null as CUSTOMER_TYPE | null, []],
    districtId: [0, []],
    address: ['', []],
  });

  selectedDepartment = signal<ValueParams | null>(null);
  deparmentsQuery = injectQuery(() => ({
    queryKey: ['department-select'],
    queryFn: () => firstValueFrom(this.localizationService.getDepartment('')),
    staleTime: 5000 * 60,
  }));

  selectedMunicipality = signal<ValueParams | null>(null);
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

  selectedDistrict = signal<ValueParams | null>(null);
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

  selectedEconomicActivity = signal<ValueParams | null>(null);
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
          .pipe(map((items) => this.mapEconomicActivity(items))),
      ),
    staleTime: 5000 * 60,
    enabled: this.econTouched(),
  }));

  taxDocumentTypeQuery = injectQuery(() => ({
    queryKey: ['documenty-type-combobox'],
    queryFn: () =>
      firstValueFrom(this.catalogService.getCatalog('tax-document-type')),
    staleTime: 5000 * 60,
  }));

  // ---------- Combobox handlers ----------
  districtTouched() {
    this.customerForm.get('districtId')?.setValue(null);
    this.customerForm.get('districtId')?.markAsTouched();
    this.selectedDistrict.set(null);
  }

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

  setDistrict(district: ValueParams | null) {
    this.customerForm.get('districtId')?.setValue(district?.id ?? null);
    this.customerForm.get('districtId')?.markAsDirty();
    this.selectedDistrict.set(district);
  }

  onDistrictChange(event: Event) {
    const id = Number((event.target as HTMLSelectElement).value);
    this.setDistrict(
      this.districtsQuery.data()?.find((district) => district.id === id) ?? null,
    );
  }

  setEconomicActivity(economicActivity: ValueParams | null) {
    this.customerForm
      .get('taxInfo.economicActivityId')
      ?.setValue(economicActivity?.id);
    this.customerForm.get('taxInfo.economicActivityId')?.markAsDirty();
    this.selectedEconomicActivity.set(economicActivity);
  }

  mapEconomicActivity(economicActivity: CatalogItem[]) {
    return economicActivity.map((item) => ({
      id: item.id,
      name: item.name,
    }));
  }

  // ---------- isTaxPayer / wizard ----------
  onTaxPayerToggle(event: Event): void {
    if (this.taxPayerRequired()) return;
    // El (change) se dispara DESPUÉS del toggle nativo del checkbox, así que
    // checked ya viene con el valor nuevo (no hay que invertir nada). Antes
    // se usaba (click) + inversión, lo que peleaba con el toggle nativo y
    // hacía que el checkbox "no se pudiera seleccionar".
    const isTaxPayer = (event.target as HTMLInputElement).checked;
    this.isTaxPayerOn.set(isTaxPayer);
    this.customerForm.get('isTaxPayer')?.setValue(isTaxPayer);
    this.customerForm.get('isTaxPayer')?.markAsDirty();

    if (isTaxPayer) {
      this.createTaxInfoForm();
      this.applyBaseRequired(true);
      this.currentStep.set(1);
    } else {
      this.removeTaxInfoForm();
      this.applyBaseRequired(false);
      this.currentStep.set(1);
    }
  }

  /** Agrega/remueve `required` en el grupo base cuando cambia isTaxPayer. */
  private applyBaseRequired(required: boolean) {
    for (const field of BASE_REQUIRED_IF_TAXPAYER) {
      const control = this.customerForm.get(field);
      if (!control) continue;
      if (required) {
        control.addValidators([Validators.required]);
        if (field === 'districtId') {
          control.addValidators([this.formUtils.noSelected]);
        }
        control.setValue(control.value); // re-validar con 0/''
      } else {
        control.removeValidators([Validators.required]);
        if (field === 'districtId') {
          control.removeValidators([this.formUtils.noSelected]);
        }
      }
      control.updateValueAndValidity({ emitEvent: false });
    }
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
   * which Angular updates the control (same reason as `onTaxPayerToggle`).
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

  createTaxInfoForm() {
    if (!this.customerForm.get('taxInfo')) {
      const group = this.fb.group({
        tradeName: ['', [Validators.required]],
        taxDocumentTypeId: [0, [Validators.required]],
        taxDocumentNumber: [
          '',
          [
            Validators.required,
            FormUtils.digitsOnlyIf(() => this.isNitOrDuiSelected()),
          ],
        ],
        nrc: ['', [Validators.required]],
        economicActivityId: [null as number | null, [Validators.required]],
      }) as unknown as FormGroup<TaxInfoForm>;
      this.customerForm.addControl('taxInfo', group);

      // Prioridad 1: snapshot del backend (datos reales del cliente).
      // Prioridad 2: caché de sesión (tecleados entre desmarcar/re-marcar).
      // Si hay valores en la sesión, los non-vacíos sobrescriben al snapshot.
      const snapshot = this.editTaxInfoSnapshot();
      const cached = this.taxInfoCache();
      const source = snapshot ?? cached;
      if (source) {
        group.patchValue({
          tradeName: source.tradeName ?? '',
          taxDocumentTypeId: source.taxDocumentTypeId ?? 0,
          taxDocumentNumber: source.taxDocumentNumber ?? '',
          nrc: source.nrc ?? '',
          economicActivityId: source.economicActivityId ?? null,
        });
        // Restaurar la selección del combobox de actividad económica
        if (source.economicActivityId != null) {
          this.selectedEconomicActivity.set({
            id: source.economicActivityId,
            name: '',
          });
        }
      }
      this.customerForm.get('taxInfo')?.markAsDirty();
    }
  }

  removeTaxInfoForm() {
    const taxGroup = this.customerForm.get('taxInfo');
    if (taxGroup) {
      // Cachear ANTES de remover: los datos vuelven si se re-marca el toggle.
      this.taxInfoCache.set(taxGroup.getRawValue());
      this.customerForm.removeControl('taxInfo');
    }
    // selectedEconomicActivity NO se limpia: la selección se conserva para
    // que el combobox muestre el valor restaurado al re-marcar.
  }

  goNext() {
    this.customerForm.markAllAsTouched();
    // En el paso 1 solo se validan los campos visibles de la primera página
    const fields = [
      'name',
      'email',
      'phone',
      'customerType',
      'districtId',
      'address',
    ];
    const validStep = fields.every(
      (field) => this.customerForm.get(field)?.valid,
    );
    if (!validStep) return;
    this.currentStep.set(2);
  }

  goBack() {
    this.currentStep.set(1);
  }

  // ---------- Mutations ----------
  mutationCreate = injectMutation(() => ({
    mutationFn: (customerLike: CustomerPayload) =>
      firstValueFrom(this.customerService.createCustomer(customerLike)),
    onSuccess: (customer) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['customers'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Cliente creado con éxito');
      this.saved.emit(customer);
      this.closeModal();
    },
    onError: (error): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(
        error?.message || 'Error al crear el cliente',
      );
    },
  }));

  mutationUpdate = injectMutation(() => ({
    mutationFn: ({ id, customerLike }: customerUpdateVars) =>
      firstValueFrom(this.customerService.updateCustomer(id, customerLike)),
    onSuccess: (customer) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['customers'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Cliente actualizado con éxito');
      this.saved.emit(customer);
      this.closeModal();
    },
    onError: (error): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(
        error?.message || 'Error al actualizar el cliente',
      );
    },
  }));

  // ---------- Modal API (igual que brand-form-modal) ----------
  openForCreate(requireTaxPayer = false): void {
    this.resetState();
    this.requireTaxPayer(requireTaxPayer);
    this.takeSnapshot();
    this.formModal?.nativeElement?.showModal();
  }

  openForEdit(customer: Customer, requireTaxPayer = false): void {
    this.resetState();
    this.customerId.set(customer.id);
    // Guardar snapshot del taxInfo del backend ANTES de cualquier manipulación
    this.editTaxInfoSnapshot.set(customer.taxInfo ?? null);
    this.setFormValue(customer);
    this.requireTaxPayer(requireTaxPayer);
    this.customerForm.markAsPristine();
    this.customerForm.markAsUntouched();
    this.takeSnapshot();
    this.formModal?.nativeElement?.showModal();
  }

  closeModal() {
    this.formModal?.nativeElement?.close();
    this.resetState();
  }

  private requireTaxPayer(required: boolean): void {
    this.taxPayerRequired.set(required);
    if (!required) return;
    this.isTaxPayerOn.set(true);
    this.customerForm.controls.isTaxPayer.setValue(true);
    this.createTaxInfoForm();
    this.applyBaseRequired(true);
    this.customerForm.controls.isTaxPayer.disable();
  }

  private resetState(): void {
    this.taxPayerRequired.set(false);
    this.customerId.set(0);
    this.isSubmitting.set(false);
    this.currentStep.set(1);
    this.isTaxPayerOn.set(false);
    this.taxInfoCache.set(null);
    this.editTaxInfoSnapshot.set(null);
    if (this.customerForm.get('taxInfo')) {
      this.customerForm.removeControl('taxInfo');
    }
    this.applyBaseRequired(false);
    this.customerForm.reset({
      name: '',
      isTaxPayer: false,
      email: '',
      phone: '',
      customerType: null,
      districtId: 0,
      address: '',
    });
    this.customerForm.get('isTaxPayer')?.enable();
    this.selectedDepartment.set(null);
    this.selectedMunicipality.set(null);
    this.selectedDistrict.set(null);
    this.selectedEconomicActivity.set(null);
  }

  setFormValue(customer: Partial<Customer>): void {
    if (!customer) return;
    this.customerForm.patchValue({
      name: customer.name ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      customerType: customer.customerType ?? null,
      districtId: customer.districtId ?? 0,
      address: customer.address ?? '',
    });
    // El flag fiscal se maneja con setValue dedicado (evita doble toggle
    // con el (click) del template y permite editarlo en el modal).
    this.customerForm.get('isTaxPayer')?.enable();
    this.customerForm.get('isTaxPayer')?.setValue(!!customer.isTaxPayer);
    this.isTaxPayerOn.set(!!customer.isTaxPayer);

    if (customer.isTaxPayer) {
      this.createTaxInfoForm();
      this.applyBaseRequired(true);
      this.customerForm.patchValue({
        taxInfo: {
          tradeName: customer.taxInfo?.tradeName,
          taxDocumentTypeId: customer.taxInfo?.taxDocumentTypeId,
          taxDocumentNumber: customer.taxInfo?.taxDocumentNumber,
          nrc: customer.taxInfo?.nrc,
          economicActivityId: customer.taxInfo?.economicActivityId,
        },
      });
      const economicActivityId = customer.taxInfo?.economicActivityId;
      this.selectedEconomicActivity.set(
        economicActivityId == null ? null : {
          id: economicActivityId,
          name: customer.taxInfo?.economicActivity?.name ?? '',
        },
      );
      this.customerForm.get('taxInfo.economicActivityId')?.markAsDirty();
    }

    if (customer.district) {
      this.selectedDistrict.set({
        id: customer.district.id,
        name: customer.district.name,
      });
      if (customer.district.municipality) {
        this.selectedMunicipality.set({
          id: customer.district.municipality.id,
          name: customer.district.municipality.name,
        });
        if (customer.district.municipality.department) {
          this.selectedDepartment.set({
            id: customer.district.municipality.department.id,
            name: customer.district.municipality.department.name,
          });
        }
      }
    }
  }

  private originalSnapshot: Record<string, unknown> | null = null;

  private takeSnapshot(): void {
    const raw = this.customerForm.getRawValue() as Record<string, unknown>;
    this.originalSnapshot = JSON.parse(JSON.stringify(raw));
  }

  private buildCustomerLike(): CustomerPayload {
    const raw = this.customerForm.getRawValue();
    const isTaxPayer = this.isTaxPayerOn();
    const taxInfoData = this.customerForm.controls.taxInfo?.value ?? null;

    if (isTaxPayer) {
      // CONTRIBUYENTE: el backend espera TODOS los campos (create y update),
      // así que enviamos el objeto completo.
      const full: CustomerPayload = {
        name: String(raw['name'] ?? '').trim(),
        isTaxPayer: true,
        email: String(raw['email'] ?? '')
          .trim()
          .toLowerCase(),
        phone: FormUtils.sanitizePhone(String(raw['phone'] ?? '')),
        customerType: raw['customerType'],
        districtId: (raw['districtId'] ? +raw['districtId'] : null),
        address: String(raw['address'] ?? '').trim(),
        taxInfo: {
          tradeName: String(taxInfoData?.tradeName ?? '').trim(),
          nrc: String(taxInfoData?.nrc ?? '').trim(),
          taxDocumentTypeId: taxInfoData?.taxDocumentTypeId,
          economicActivityId: taxInfoData?.economicActivityId,
          taxDocumentNumber: String(
            taxInfoData?.taxDocumentNumber ?? '',
          ).trim(),
        },
      };
      return full;
    }

    // NO CONTRIBUYENTE: solo datos del cliente, SIN taxInfo.
    if (!this.isEditing()) {
      const created: CustomerPayload = {
        name: String(raw['name'] ?? '').trim(),
        isTaxPayer: false,
        email: (String(raw['email'] ?? '')
          .trim()
          .toLowerCase() || undefined),
        phone: FormUtils.sanitizePhone(String(raw['phone'] ?? '')),
        customerType: raw['customerType'],
        districtId: (raw['districtId'] ? +raw['districtId'] : null),
        address: (String(raw['address'] ?? '').trim() || undefined),
      };
      return created;
    }

    // Edición no contribuyente: dirty-only de la base (respetando lo que
    // tocó el usuario) + flag isTaxPayer si cambió.
    const orig = this.originalSnapshot ?? {};
    const same = (a: unknown, b: unknown): boolean =>
      JSON.stringify(a) === JSON.stringify(b);
    const like: CustomerPayload = {};
    const pick = (
      key: 'name' | 'email' | 'phone' | 'customerType' | 'address',
    ): void => {
      const control = this.customerForm.get(key);
      if (control?.dirty && !same(raw[key], orig[key])) {
        if (key === 'customerType') {
          like.customerType = raw.customerType;
        } else {
          like[key] = this.sanitizeBaseField(key, raw[key]);
        }
      }
    };
    pick('name');
    pick('email');
    pick('phone');
    pick('customerType');
    pick('address');
    if (
      this.customerForm.get('districtId')?.dirty &&
      !same(raw['districtId'], orig['districtId'])
    ) {
      like.districtId = (
        raw['districtId'] ? +raw['districtId'] : null
      );
    }
    if (this.customerForm.get('isTaxPayer')?.dirty) {
      like.isTaxPayer = false;
    }
    return like;
  }

  private sanitizeBaseField(key: string, value: unknown): string | null {
    const s = String(value ?? '').trim();
    if (key === 'phone') return FormUtils.sanitizePhone(String(value ?? ''));
    if (key === 'email') return s.toLowerCase() || null;
    if (key === 'address') return s || null;
    return s || null;
  }

  onSubmit(): void {
    if (this.isSubmitting()) return;
    this.customerForm.markAllAsTouched();
    if (this.customerForm.invalid) return;
    const customerLike = this.buildCustomerLike();
    if (this.isEditing() && Object.keys(customerLike).length === 0) {
      this.closeModal();
      return;
    }

    this.isSubmitting.set(true);

    if (this.isEditing()) {
      this.mutationUpdate.mutate({
        id: this.customerId(),
        customerLike,
      });
    } else {
      this.mutationCreate.mutate(customerLike);
    }
  }
}
