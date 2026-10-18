import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  injectMutation,
  injectQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { CompanyService } from '../../services/company.service';
import { UpdateCompanySettings } from '../../interfaces/company.interface';
import { LocalizationService } from '../../../shared/services/localization.service';
import { ValueParams } from '../../../shared/components/combobox/interfaces/search-param.interface';
import { ComboboxFormControlComponent } from '../../../shared/components/combobox-form-control/combobox-form-control.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { TitleComponent } from '../../../shared/components/title/title.component';
import { CatalogItem, CatalogService } from '../../../shared/services/catalog.service';

@Component({
  selector: 'app-company-page',
  imports: [
    ReactiveFormsModule,
    ComboboxFormControlComponent,
    AlertComponent,
    TitleComponent,
  ],
  templateUrl: './company-page.component.html',
})
export class CompanyPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly companyService = inject(CompanyService);
  private readonly localizationService = inject(LocalizationService);
  private readonly catalogService = inject(CatalogService);
  private readonly alertService = inject(AlertService);
  private readonly queryClient = inject(QueryClient);

  readonly form = this.formBuilder.nonNullable.group({
    legalName: ['', Validators.required],
    tradeName: [''],
    nit: ['', Validators.required],
    nrc: [''],
    registryNo: [''],
    address: ['', Validators.required],
    municipalityId: [0, [Validators.required, Validators.min(1)]],
    districtId: [0, [Validators.required, Validators.min(1)]],
    economicActivityId: [0, [Validators.required, Validators.min(1)]],
    responsableName: [''],
    responsableDocTypeId: [0],
    responsableDocNumber: [''],
    phone: [''],
    email: ['', Validators.email],
    website: [''],
    ivaRate: [0.13, [Validators.min(0), Validators.max(1)]],
  });

  readonly selectedDepartment = signal<ValueParams | null>(null);
  readonly selectedMunicipality = signal<ValueParams | null>(null);
  readonly selectedDistrict = signal<ValueParams | null>(null);
  readonly companyId = signal<number | null>(null);
  readonly isSaving = signal(false);
  readonly selectedEconomicActivity = signal<ValueParams | null>(null);
  readonly economicActivitySearch = signal('');

  readonly companyQuery = injectQuery(() => ({
    queryKey: ['company-settings'],
    queryFn: () => firstValueFrom(this.companyService.getCompany()),
    staleTime: Infinity,
  }));

  readonly departmentsQuery = injectQuery(() => ({
    queryKey: ['locations', 'departments'],
    queryFn: () => firstValueFrom(this.localizationService.getDepartment('')),
    staleTime: Infinity,
  }));

  readonly municipalitiesQuery = injectQuery(() => ({
    queryKey: ['locations', 'municipalities', this.selectedDepartment()?.id],
    queryFn: () =>
      firstValueFrom(
        this.localizationService.getMunicipality(
          '',
          this.selectedDepartment()?.id ?? 0,
        ),
      ),
    enabled: !!this.selectedDepartment(),
    staleTime: Infinity,
  }));

  readonly districtsQuery = injectQuery(() => ({
    queryKey: ['locations', 'districts', this.selectedMunicipality()?.id],
    queryFn: () =>
      firstValueFrom(
        this.localizationService.getDistrict(
          '',
          this.selectedMunicipality()?.id ?? 0,
        ),
      ),
    enabled: !!this.selectedMunicipality(),
    staleTime: Infinity,
  }));

  readonly economicActivitiesQuery = injectQuery(() => ({
    queryKey: ['catalog', 'economic-activity', this.economicActivitySearch()],
    queryFn: () =>
      firstValueFrom(
        this.catalogService.getCatalog(
          'economic-activity',
          this.economicActivitySearch(),
        ),
      ).then((items: CatalogItem[]) =>
        items.map(({ id, name }) => ({ id, name })),
      ),
    staleTime: 5 * 60 * 1000,
  }));

  readonly taxDocumentTypesQuery = injectQuery(() => ({
    queryKey: ['catalog', 'tax-document-type'],
    queryFn: () =>
      firstValueFrom(this.catalogService.getCatalog('tax-document-type')),
    staleTime: 5 * 60 * 1000,
  }));

  readonly isLoading = computed(
    () => this.companyQuery.isPending() || this.companyQuery.isError(),
  );

  private readonly populateEffect = effect(() => {
    const company = this.companyQuery.data();
    if (!company || this.companyId() === company.id) return;
    const district = company.district;
    this.companyId.set(company.id);
    this.form.patchValue({
      legalName: company.legalName,
      tradeName: company.tradeName ?? '',
      nit: company.nit,
      nrc: company.nrc ?? '',
      registryNo: company.registryNo ?? '',
      address: company.address,
      municipalityId: district?.municipality.id ?? 0,
      districtId: district?.id ?? 0,
      economicActivityId: company.economicActivityId,
      responsableName: company.responsableName ?? '',
      responsableDocTypeId: company.responsableDocTypeId ?? 0,
      responsableDocNumber: company.responsableDocNumber ?? '',
      phone: company.phone ?? '',
      email: company.email ?? '',
      website: company.website ?? '',
      ivaRate: company.ivaRate ?? 0.13,
    });

    if (!district) return;
    this.selectedDepartment.set(district.municipality.department);
    this.selectedMunicipality.set({
      id: district.municipality.id,
      name: district.municipality.name,
    });
    this.selectedDistrict.set({ id: district.id, name: district.name });
    this.selectedEconomicActivity.set(company.economicActivity);
  });

  readonly updateMutation = injectMutation(() => ({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateCompanySettings }) =>
      firstValueFrom(this.companyService.updateCompany(id, payload)),
    onMutate: () => this.isSaving.set(true),
    onSuccess: (company) => {
      this.isSaving.set(false);
      this.queryClient.setQueryData(['company-settings'], company);
      this.form.markAsPristine();
      this.alertService.showSuccess('Configuración guardada correctamente');
    },
    onError: (error: Error) => {
      this.isSaving.set(false);
      this.alertService.showError(error.message || 'No se pudo guardar la configuración');
    },
  }));

  setDepartment(value: ValueParams | null) {
    this.selectedDepartment.set(value);
    this.selectedMunicipality.set(null);
    this.selectedDistrict.set(null);
    this.form.patchValue({ municipalityId: 0, districtId: 0 });
  }

  onDepartmentChange(event: Event) {
    const id = Number((event.target as HTMLSelectElement).value);
    this.setDepartment(
      this.departmentsQuery.data()?.find((department) => department.id === id) ??
        null,
    );
  }

  setMunicipality(value: ValueParams | null) {
    this.selectedMunicipality.set(value);
    this.selectedDistrict.set(null);
    this.form.patchValue({
      municipalityId: value?.id ?? 0,
      districtId: 0,
    });
  }

  setDistrict(value: ValueParams | null) {
    this.selectedDistrict.set(value);
    this.form.patchValue({ districtId: value?.id ?? 0 });
  }

  setEconomicActivity(value: ValueParams | null) {
    this.selectedEconomicActivity.set(value);
    this.form.patchValue({ economicActivityId: value?.id ?? 0 });
  }

  save(): void {
    if (this.isSaving() || this.updateMutation.isPending()) return;
    const id = this.companyId();
    if (!id) {
      this.alertService.showError('No existe una configuración de empresa para editar');
      return;
    }
    if (!this.form.dirty) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.alertService.showError('Completa los campos obligatorios');
      return;
    }
    const value = this.form.getRawValue();
    const payload = {
      legalName: value.legalName,
      tradeName: value.tradeName,
      nit: value.nit,
      nrc: value.nrc,
      registryNo: value.registryNo,
      address: value.address,
      districtId: value.districtId,
      economicActivityId: value.economicActivityId,
      responsableName: value.responsableName,
      responsableDocTypeId: value.responsableDocTypeId || null,
      responsableDocNumber: value.responsableDocNumber,
      phone: value.phone,
      email: value.email,
      website: value.website,
      ivaRate: value.ivaRate,
    };
    this.updateMutation.mutate({
      id,
      payload,
    });
  }
}
