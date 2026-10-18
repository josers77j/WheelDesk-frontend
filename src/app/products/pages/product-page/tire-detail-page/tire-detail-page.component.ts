import {
  Component,
  inject,
  input,
  linkedSignal,
  signal,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormErrorLabelComponent } from '../../../../shared/components/form-error-label/form-error-label.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { Location } from '@angular/common';
import { Product, ProductTirePayload, TIRE_CONDITION, CONSTRUCTION, LOAD_RANGE, PREFIX } from '../../../interfaces/product.interface';
import {
  injectMutation,
  injectQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { Router } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { AlertService } from '../../../../shared/components/alert/alert.service';

import { ValueParams } from '../../../../shared/components/combobox/interfaces/search-param.interface';
import { BrandService } from '../../../../brands/services/brand.service';
import { ProviderService } from '../../../../providers/services/provider.service';

import { FormUtils } from '../../../../shared/utils/form-utils';
import { firstValueFrom } from 'rxjs';
import { PRODUCT_TYPE } from '../../../interfaces/product-type.enum';
import { ComboboxFormControlComponent } from '../../../../shared/components/combobox-form-control/combobox-form-control.component';
import { invalidateCatalogCaches } from '../../../../shared/utils/invalidate-catalog-caches.util';

interface productUpdateVars {
  id: number;
  tireLike: Partial<ProductTirePayload>;
}


@Component({
  selector: 'app-tire-detail-page',
  imports: [
    ReactiveFormsModule,
    FormErrorLabelComponent,
    AlertComponent,
    ComboboxFormControlComponent,
  ],
  templateUrl: './tire-detail-page.component.html',
})
export class TireDetailPageComponent implements OnInit {
  // Dependency Injection
  constructor(private readonly location: Location) {}

  fb = inject(FormBuilder);
  queryClient = inject(QueryClient);
  router = inject(Router);
  productService = inject(ProductService);
  brandService = inject(BrandService);
  providerService = inject(ProviderService);
  alertService = inject(AlertService);

  // Inputs
  tire = input.required<Product>();
  typeProduct = input();

  // Linked / Derived Signals
  setTypeProduct = linkedSignal(() => this.typeProduct() ?? 'tire');

  // Utilities
  formUtils = FormUtils;

  /** Blocks extra digits while typing in width/profile/rim (3 integers, 2 decimals). */
  restrictMeasureDigits = FormUtils.restrictMeasureDigits;

  // UI State Signals
  wasSave = signal(false);
  isLoading = signal<boolean>(false);

  // Generic Resources / Signals
  tireResource = signal<ValueParams[]>([{ id: 2, name: 'marca' }]);

  // Form Definition
  tireForm = this.fb.group({
    notes: ['', []],
    salePrice: ['', [Validators.required]],
    purchasePrice: ['', [Validators.required]],
    brandId: [0, [Validators.required, this.formUtils.noSelected]],
    providerId: [0, []],
    prefix: ['' as PREFIX | '', []],
    width: [null as number | null, [Validators.required]],
    aspectRatio: [null as number | null, []],
    construction: [CONSTRUCTION.RADIAL as CONSTRUCTION, [Validators.required]],
    rimDiameter: [null as number | null, [Validators.required]],
    loadIndexFront: [null as number | null, []],
    loadIndexRear: [null as number | null, []],
    speedRating: ['', [Validators.maxLength(1)]],
    loadRange: ['' as LOAD_RANGE | '', []],
    plies: [null as number | null, []],
    tireCondition: [null as TIRE_CONDITION | null, [Validators.required]],
    vehicleTypeIds: [[] as number[], [Validators.required]],
  });

  prefixList = signal<{ title: string; value: PREFIX | '' }[]>([
    { title: 'Sin prefijo', value: '' },
    { title: 'P - Pasajero', value: PREFIX.P },
    { title: 'LT - Camioneta ligera', value: PREFIX.LT },
    { title: 'ST - Tráiler especial', value: PREFIX.ST },
    { title: 'T - Temporal (refacción)', value: PREFIX.T },
  ]);

  constructionList = signal<{ title: string; value: CONSTRUCTION }[]>([
    { title: 'Radial (R)', value: CONSTRUCTION.RADIAL },
    { title: 'Diagonal (D)', value: CONSTRUCTION.BIAS },
    { title: 'Bias-belted (B)', value: CONSTRUCTION.BELTED },
  ]);

  loadRangeList = signal<{ title: string; value: LOAD_RANGE | '' }[]>([
    { title: 'Sin rango de carga', value: '' },
    { title: 'C - Refuerzo comercial', value: LOAD_RANGE.REINFORCED },
    { title: 'XL - Extra Load', value: LOAD_RANGE.EXTRA_LOAD },
  ]);

  // Brand Section
  selectedBrand = signal<ValueParams | null>(null);

  setBrand(brand: ValueParams | null) {
    this.tireForm.get('brandId')?.setValue(brand?.id ?? null);
    this.tireForm.get('brandId')?.markAsDirty();
    this.selectedBrand.set(brand);
  }

  brandCombobox = signal<string>('');
  brandComboboxOutput = signal<string>('');
  /** Perezoso: pide al interactuar con su combobox. */
  brandTouched = signal(false);

  brandsQuery = injectQuery(() => ({
    queryKey: ['brand-combobox', this.brandComboboxOutput()],

    queryFn: () =>
      firstValueFrom(
        this.brandService.getBrandByName(
          this.limit,
          this.brandComboboxOutput(),
        ),
      ),
    staleTime: 5000 * 60,
    enabled: this.brandTouched(),
  }));

  limit = 5;

  // Provider Section
  selectedProvider = signal<ValueParams | null>(null);

  setProvider(provider: ValueParams | null) {
    this.tireForm.get('providerId')?.setValue(provider?.id ?? null);
    this.tireForm.get('providerId')?.markAsDirty();
    this.selectedProvider.set(provider);
  }
  providerComboboxOutput = signal<string>('');
  /** Perezoso: pide al interactuar con su combobox. */
  providerTouched = signal(false);

  providersQuery = injectQuery(() => ({
    queryKey: ['provider-combobox', this.providerComboboxOutput()],

    queryFn: () =>
      firstValueFrom(
        this.providerService.getProviderByName(
          this.limit,
          this.providerComboboxOutput(),
        ),
      ),
    staleTime: 5000 * 60,
    enabled: this.providerTouched(),
  }));

  // Static Lists (Enums / UI Options)
  vehicleTypesQuery = injectQuery(() => ({
    queryKey: ['vehicle-types'],
    queryFn: () => firstValueFrom(this.productService.getVehicleTypes()),
    staleTime: 5000 * 60,
  }));

  selectedVehicleTypes = signal<number[]>([]);

  toggleVehicleType(vehicleTypeId: number) {
    this.selectedVehicleTypes.update((current) => {
      if (current.includes(vehicleTypeId)) {
        return current.filter((id) => id !== vehicleTypeId);
      }
      return [...current, vehicleTypeId];
    });
    this.tireForm.get('vehicleTypeIds')?.setValue(this.selectedVehicleTypes());
    this.tireForm.get('vehicleTypeIds')?.markAsDirty();
  }

  tireConditionList = signal<{ title: string; value: string }[]>([
    { title: 'Nuevo', value: 'NEW' },
    { title: 'Usado', value: 'USED' },
    { title: 'Emergencia', value: 'EMERGENCY' },
  ]);

  // Combobox UI Config
  placeholderInput = signal<{ provider: string; brand: string }>({
    provider: 'proveedor',
    brand: 'marca',
  });

  private originalValue: unknown = null;

  hasChanges() {
    return FormUtils.hasChanges(this.tireForm, this.originalValue);
  }

  // Submit Handler
  onSubmit(): void {
    if (this.isLoading()) return;
    this.tireForm.markAllAsTouched();
    const isValid = this.tireForm.valid;
    const isDirty = this.hasChanges();

    if (!isDirty) return;
    if (!isValid) return;

    const id = this.tire().id;
    this.isLoading.set(true);

    const {
      notes,
      salePrice,
      purchasePrice,
      brandId,
      providerId,
      prefix,
      width,
      aspectRatio,
      construction,
      rimDiameter,
      loadIndexFront,
      loadIndexRear,
      speedRating,
      loadRange,
      plies,
      tireCondition,
      vehicleTypeIds,
    } = this.tireForm.value;

    const tireLike: Partial<ProductTirePayload> = {
      notes,
      salePrice: salePrice!,
      purchasePrice: purchasePrice!,
      brandId,
      providerId: providerId ?? null,
      tire: {
        // prefix '' explícito para quitar el prefijo; undefined = no enviado
        prefix: prefix === '' ? '' : (prefix || undefined),
        width: Number(width),
        aspectRatio: aspectRatio ? Number(aspectRatio) : undefined,
        construction: construction ?? (CONSTRUCTION.RADIAL as CONSTRUCTION),
        rimDiameter: Number(rimDiameter),
        loadIndexFront: loadIndexFront ? Number(loadIndexFront) : undefined,
        loadIndexRear: loadIndexRear ? Number(loadIndexRear) : undefined,
        speedRating: speedRating || undefined,
        loadRange: loadRange === '' ? '' : (loadRange || undefined),
        plies: +plies!,
        condition: tireCondition ?? null,
        vehicleTypeId: vehicleTypeIds ?? [],
      },
    };

    if (id === 0) {
      this.mutationCreate.mutate(tireLike);
    } else {
      this.mutationUpdate.mutate({
        id,
        tireLike,
      });
    }
  }

  // Mutations (Create / Update)
  mutationCreate = injectMutation(() => ({
    mutationFn: (tireLike: Partial<ProductTirePayload>) =>
      firstValueFrom(this.productService.createTire(tireLike)),
    onSuccess: (tire) => {
      this.queryClient.invalidateQueries({ queryKey: ['tires'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Producto creado con éxito');
      this.isLoading.set(false);
      this.router.navigate(['/products/detail', tire.id], {
        queryParams: {
          productType: PRODUCT_TYPE.TIRE,
        },
      });
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  mutationUpdate = injectMutation(() => ({
    mutationFn: ({ id, tireLike }: productUpdateVars) =>
      firstValueFrom(this.productService.updateTire(id, tireLike)),
    onSuccess: () => {
      this.queryClient.invalidateQueries({ queryKey: ['tires'] });
      invalidateCatalogCaches(this.queryClient);
      this.isLoading.set(false);
      this.alertService.showSuccess('Producto actualizado con éxito');
      this.originalValue = this.tireForm.getRawValue();
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  // Lifecycle Hooks
  ngOnInit() {
    this.setFormValue(this.tire());
  }

  // Form Helpers
  setFormValue(product: Partial<Product>) {
    if (!product) return;

    this.tireForm.patchValue({
      notes: product.notes ?? '',
      salePrice: product.salePrice ?? '',
      purchasePrice: product.purchasePrice ?? '',
      brandId: product.brandId ?? null,
      providerId: product.providerId ?? null,
      prefix: product.tire?.prefix ?? '',
      width: product.tire?.width ?? null,
      aspectRatio: product.tire?.aspectRatio ?? null,
      construction:
        product.tire?.construction ?? (CONSTRUCTION.RADIAL as CONSTRUCTION),
      rimDiameter: product.tire?.rimDiameter
        ? Number(product.tire.rimDiameter)
        : null,
      loadIndexFront: product.tire?.loadIndexFront ?? null,
      loadIndexRear: product.tire?.loadIndexRear ?? null,
      speedRating: product.tire?.speedRating ?? '',
      loadRange: product.tire?.loadRange ?? '',
      plies: product.tire?.plies ?? 0,
      tireCondition: product.tire?.condition ?? null,
    });
    // Cargar tipos de vehículo existentes (backend devuelve productVehicleType)
    const vehicleTypeIds =
      product.productVehicleType
        ?.map((pvt) => pvt.vehicleType?.id)
        .filter((id: number) => id != null) ?? [];
    if (vehicleTypeIds.length > 0) {
      this.selectedVehicleTypes.set(vehicleTypeIds);
      this.tireForm.get('vehicleTypeIds')?.setValue(vehicleTypeIds);
    }

    this.selectedBrand.set(product.brand ? { id: product.brand.id, name: product.brand.name } : null);
    this.selectedProvider.set(product.provider ? { id: product.provider.id, name: product.provider.name } : null);
    this.originalValue = this.tireForm.getRawValue();
  }

  // Navigation
  backToPreviousPage() {
    this.location.back();
  }
}
