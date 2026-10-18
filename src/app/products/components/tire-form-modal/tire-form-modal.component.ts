import {
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  QueryClient,
  injectMutation,
  injectQuery,
} from '@tanstack/angular-query-experimental';

import { BrandService } from '../../../brands/services/brand.service';
import { ProviderService } from '../../../providers/services/provider.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { ValueParams } from '../../../shared/components/combobox/interfaces/search-param.interface';
import { ComboboxFormControlComponent } from '../../../shared/components/combobox-form-control/combobox-form-control.component';
import { FormErrorLabelComponent } from '../../../shared/components/form-error-label/form-error-label.component';
import { tireChoice, tireNumber } from './tire-validators';
import { FormUtils } from '../../../shared/utils/form-utils';
import { Product, ProductTirePayload, TireRequest, TIRE_CONDITION, CONSTRUCTION, LOAD_RANGE, PREFIX, TIRE_QUALITY, SPEED_RATING } from '../../interfaces/product.interface';
import { ProductService } from '../../services/product.service';
import { buildDirtyLike } from '../../utils/dirty-like';
import { CatalogService } from '../../../shared/services/catalog.service';
import { invalidateCatalogCaches } from '../../../shared/utils/invalidate-catalog-caches.util';

interface productUpdateVars {
  id: number;
  tireLike: Partial<ProductTirePayload>;
}


@Component({
  selector: 'app-tire-form-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormErrorLabelComponent,
    ComboboxFormControlComponent,
  ],
  templateUrl: './tire-form-modal.component.html',
})
export class TireFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly productService = inject(ProductService);
  private readonly brandService = inject(BrandService);
  private readonly providerService = inject(ProviderService);
  private readonly catalogService = inject(CatalogService);
  private readonly alertService = inject(AlertService);
  private readonly queryClient = inject(QueryClient);

  @ViewChild('formModal') formModal!: ElementRef<HTMLDialogElement>;

  saved = output<Product>();
  readonly draftSaved = output<Partial<ProductTirePayload>>();
  readonly draftMode = signal(false);
  readonly draftBrandName = signal('');

  productId = signal<number>(0);
  /** Perezoso: catálogos solo cuando el modal se abre. */
  modalOpen = signal(false);
  isEditing = computed(() => this.productId() > 0);
  isSubmitting = signal<boolean>(false);
  readonly optionalExpanded = signal(false);

  onOptionalToggle(event: Event): void {
    if (event.target instanceof HTMLDetailsElement) this.optionalExpanded.set(event.target.open);
  }

  private expandOptionalData(): void {
    const values = this.tireForm.getRawValue();
    const optional = [values.providerId, values.notes, values.prefix, values.loadRange,
      values.loadIndexFront, values.loadIndexRear, values.speedRating, values.plies];
    this.optionalExpanded.set(optional.some((value): boolean =>
      typeof value === 'string' ? value.trim().length > 0 : value != null,
    ));
  }

  formUtils = FormUtils;

  /** Blocks extra digits while typing in width/profile/rim (3 integers, 2 decimals). */
  restrictMeasureDigits = FormUtils.restrictMeasureDigits;

  tireForm = this.fb.group({
    notes: ['', []],
    salePrice: ['', [Validators.required, tireNumber('Precio de venta', { positive: true })]],
    purchasePrice: ['', [Validators.required, tireNumber('Precio de compra', { positive: true })]],
    brandId: [0, [Validators.required, this.formUtils.noSelected, tireNumber('Marca', { integer: true, positive: true })]],
    providerId: [null as number | null, [tireNumber('Proveedor', { integer: true, positive: true })]],
    prefix: ['' as PREFIX | '', [tireChoice('Prefijo', Object.values(PREFIX), true)]],
    width: [null as number | null, [Validators.required, tireNumber('Ancho de la llanta', { integer: true, min: 90, max: 525 })]],
    aspectRatio: [null as number | null, [tireNumber('Perfil', { integer: true, min: 25, max: 95 })]],
    construction: [CONSTRUCTION.RADIAL as CONSTRUCTION, [Validators.required, tireChoice('Construcción', Object.values(CONSTRUCTION))]],
    rimDiameter: [null as number | null, [Validators.required, tireNumber('Diámetro de rin', { positive: true })]],
    loadIndexFront: [null as number | null, [tireNumber('Índice de carga delantero', { integer: true, min: 0, max: 279 })]],
    loadIndexRear: [null as number | null, [tireNumber('Índice de carga trasero', { integer: true, min: 0, max: 279 })]],
    speedRating: ['' as SPEED_RATING | '', [tireChoice('Índice de velocidad', 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split(''), true)]],
    loadRange: ['' as LOAD_RANGE | '', [tireChoice('Rango de carga', Object.values(LOAD_RANGE), true)]],
    plies: [null as number | null, [tireNumber('Número de lonas', { integer: true })]],
    tireCondition: [null as TIRE_CONDITION | null, [Validators.required, tireChoice('Condición', Object.values(TIRE_CONDITION))]],
    tireQuality: [null as TIRE_QUALITY | null, [Validators.required, tireChoice('Calidad', Object.values(TIRE_QUALITY))]],
    itemTypeCatalogId: [0, [Validators.required, this.formUtils.noSelected]],
    unitOfMeasureCatalogId: [0, [Validators.required, this.formUtils.noSelected]],
    vehicleTypeId: [[] as number[], [Validators.required]],
  });

  // ---------- Radios / combobox ----------
  tireConditionList = signal<{ title: string; value: TIRE_CONDITION }[]>([
    { title: 'Nuevo', value: TIRE_CONDITION.NEW },
    { title: 'Usado', value: TIRE_CONDITION.USED },
    { title: 'Emergencia', value: TIRE_CONDITION.EMERGENCY },
  ]);

  tireQualityList = signal<{ title: string; value: TIRE_QUALITY }[]>([
    { title: 'A', value: TIRE_QUALITY.A },
    { title: 'B', value: TIRE_QUALITY.B },
    { title: 'C', value: TIRE_QUALITY.C },
    { title: 'D', value: TIRE_QUALITY.D },
  ]);

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

  speedRatingList = signal<{ title: string; value: SPEED_RATING | '' }[]>([
    { title: 'Sin rating', value: '' },
    { title: 'H - hasta 210 km/h', value: SPEED_RATING.H },
    { title: 'J - hasta 100 km/h', value: SPEED_RATING.J },
    { title: 'K - hasta 110 km/h', value: SPEED_RATING.K },
    { title: 'L - hasta 120 km/h', value: SPEED_RATING.L },
    { title: 'M - hasta 130 km/h', value: SPEED_RATING.M },
    { title: 'N - hasta 140 km/h', value: SPEED_RATING.N },
    { title: 'P - hasta 150 km/h', value: SPEED_RATING.P },
    { title: 'Q - hasta 160 km/h', value: SPEED_RATING.Q },
    { title: 'R - hasta 170 km/h', value: SPEED_RATING.R },
    { title: 'S - hasta 180 km/h', value: SPEED_RATING.S },
    { title: 'T - hasta 190 km/h', value: SPEED_RATING.T },
    { title: 'U - hasta 200 km/h', value: SPEED_RATING.U },
    { title: 'V - hasta 240 km/h', value: SPEED_RATING.V },
    { title: 'W - hasta 270 km/h', value: SPEED_RATING.W },
    { title: 'Y - hasta 300 km/h', value: SPEED_RATING.Y },
    { title: 'Z - más de 240 km/h', value: SPEED_RATING.Z },
  ]);

  // Catalog comboboxes
  selectedItemType = signal<ValueParams | null>(null);
  itemTypesQuery = injectQuery(() => ({
    queryKey: ['item-types'],
    queryFn: () => firstValueFrom(this.catalogService.getCatalog('item-type')),
    staleTime: 5000 * 60,
    enabled: this.modalOpen(),
  }));

  setItemType(item: ValueParams | null) {
    this.tireForm.get('itemTypeCatalogId')?.setValue(item?.id ?? null);
    this.tireForm.get('itemTypeCatalogId')?.markAsDirty();
    this.selectedItemType.set(item);
  }

  selectedUnitOfMeasure = signal<ValueParams | null>(null);
  unitOfMeasureComboboxOutput = signal<string>('');
  /** Perezoso: pide al interactuar con su combobox. */
  unitTouched = signal(false);
  unitOfMeasuresQuery = injectQuery(() => ({
    queryKey: ['unit-of-measures', this.unitOfMeasureComboboxOutput()],
    queryFn: () =>
      firstValueFrom(
        this.catalogService.getCatalog(
          'unit-of-measure',
          this.unitOfMeasureComboboxOutput(),
        ),
      ),
    staleTime: 5000 * 60,
    enabled: this.unitTouched(),
  }));

  private readonly preparedUnits = new Map<number, ValueParams>();

  setUnitOfMeasure(unit: ValueParams | null) {
    if (unit) this.preparedUnits.set(unit.id, { ...unit });
    this.tireForm.get('unitOfMeasureCatalogId')?.setValue(unit?.id ?? null);
    this.tireForm.get('unitOfMeasureCatalogId')?.markAsDirty();
    this.selectedUnitOfMeasure.set(unit);
  }

  vehicleTypesQuery = injectQuery(() => ({
    queryKey: ['vehicle-types'],
    queryFn: () => firstValueFrom(this.productService.getVehicleTypes()),
    staleTime: 5000 * 60,
    enabled: this.modalOpen(),
  }));

  selectedVehicleTypes = signal<number[]>([]);

  toggleVehicleType(vehicleTypeId: number) {
    this.selectedVehicleTypes.update((current) => {
      if (current.includes(vehicleTypeId)) {
        return current.filter((id) => id !== vehicleTypeId);
      }
      return [...current, vehicleTypeId];
    });
    this.tireForm.get('vehicleTypeId')?.setValue(this.selectedVehicleTypes());
    this.tireForm.get('vehicleTypeId')?.markAsDirty();
  }

  readonly limit = 100;

  private readonly originalBrandValidator = this.tireForm.controls.brandId.validator;

  selectedBrand = signal<ValueParams | null>(null);
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

  setBrand(brand: ValueParams | null) {
    this.tireForm.get('brandId')?.setValue(brand?.id ?? null);
    this.tireForm.get('brandId')?.markAsDirty();
    this.selectedBrand.set(brand);
  }

  selectedProvider = signal<ValueParams | null>(null);
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

  setProvider(provider: ValueParams | null) {
    this.tireForm.get('providerId')?.setValue(provider?.id ?? null);
    this.tireForm.get('providerId')?.markAsDirty();
    this.selectedProvider.set(provider);
  }

  placeholderInput = signal<{ provider: string; brand: string }>({
    provider: 'proveedor',
    brand: 'marca',
  });

  // ---------- Mutations ----------
  mutationCreate = injectMutation(() => ({
    mutationFn: (tireLike: Partial<ProductTirePayload>) =>
      firstValueFrom(this.productService.createTire(tireLike)),
    onSuccess: (tire) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['tires'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Producto creado con éxito');
      this.saved.emit(tire);
      this.closeModal();
    },
    onError: (exception): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  mutationUpdate = injectMutation(() => ({
    mutationFn: ({ id, tireLike }: productUpdateVars) =>
      firstValueFrom(this.productService.updateTire(id, tireLike)),
    onSuccess: (tire) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['tires'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Producto actualizado con éxito');
      this.saved.emit(tire);
      this.closeModal();
    },
    onError: (exception): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  constructor() {
    effect(() => {
      if (!this.modalOpen() || !this.draftMode()) return;
      const unit = this.unitOfMeasuresQuery.data()?.find(value => value.id === this.tireForm.controls.unitOfMeasureCatalogId.value);
      const item = this.itemTypesQuery.data()?.find(value => value.id === this.tireForm.controls.itemTypeCatalogId.value);
      if (unit && this.selectedUnitOfMeasure()?.id !== unit.id) this.selectedUnitOfMeasure.set(unit);
      if (item && this.selectedItemType()?.id !== item.id) this.selectedItemType.set(item);
    });
  }

  // ---------- Modal API ----------
  openForDraft(payload: Partial<ProductTirePayload>, brandName: string): void {
    this.resetState();
    this.draftMode.set(true); this.draftBrandName.set(brandName);
    this.tireForm.controls.purchasePrice.removeValidators(Validators.required);
    this.tireForm.controls.purchasePrice.updateValueAndValidity();
    this.tireForm.controls.brandId.clearValidators();
    this.tireForm.controls.brandId.updateValueAndValidity();
    const tire = payload.tire;
    this.tireForm.patchValue({notes:payload.notes??'',salePrice:payload.salePrice??'',purchasePrice:payload.purchasePrice??'',
      width:tire?.width??null,aspectRatio:tire?.aspectRatio??null,rimDiameter:tire?.rimDiameter??null,
      prefix:tire?.prefix??'',loadRange:tire?.loadRange??'',loadIndexFront:tire?.loadIndexFront??null,loadIndexRear:tire?.loadIndexRear??null,speedRating:Object.values(SPEED_RATING).find((rating):boolean=>rating===tire?.speedRating)??'',plies:tire?.plies??null,
      construction:tire?.construction??CONSTRUCTION.RADIAL,tireCondition:tire?.condition??null,tireQuality:tire?.quality??null,
      itemTypeCatalogId:payload.itemTypeCatalogId??0,unitOfMeasureCatalogId:payload.unitOfMeasureCatalogId??0,
      vehicleTypeId:tire?.vehicleTypeId??[]});
    this.selectedUnitOfMeasure.set(payload.unitOfMeasureCatalogId
      ? this.preparedUnits.get(payload.unitOfMeasureCatalogId) ?? null
      : null);
    this.unitTouched.set(!!payload.unitOfMeasureCatalogId);
    this.selectedVehicleTypes.set(tire?.vehicleTypeId??[]);
    this.modalOpen.set(true); this.optionalExpanded.set(false);
    this.formModal?.nativeElement.showModal();
  }

  openForCreate() {
    this.modalOpen.set(true);
    this.resetState();
    this.takeSnapshot();
    this.formModal?.nativeElement?.showModal();
  }

  openForEdit(product: Product) {
    this.modalOpen.set(true);
    this.resetState();
    this.productId.set(product.id);
    this.setFormValue(product);
    this.expandOptionalData();
    this.tireForm.markAsPristine();
    this.tireForm.markAsUntouched();
    this.takeSnapshot();
    this.formModal?.nativeElement?.showModal();
  }

  closeModal() {
    this.formModal?.nativeElement?.close();
    this.modalOpen.set(false);
    this.resetState();
  }

  private resetState(): void {
    this.brandTouched.set(false);
    this.providerTouched.set(false);
    this.unitTouched.set(false);
    this.brandComboboxOutput.set('');
    this.providerComboboxOutput.set('');
    this.unitOfMeasureComboboxOutput.set('');
    this.draftMode.set(false); this.draftBrandName.set('');
    this.tireForm.controls.purchasePrice.addValidators(Validators.required);
    this.tireForm.controls.purchasePrice.updateValueAndValidity();
    this.tireForm.controls.brandId.setValidators(this.originalBrandValidator);
    this.tireForm.controls.brandId.updateValueAndValidity();
    this.optionalExpanded.set(false);
    this.productId.set(0);
    this.isSubmitting.set(false);
    this.tireForm.reset({
      notes: '',
      salePrice: '',
      purchasePrice: '',
      brandId: 0,
      providerId: null,
      prefix: '',
      width: null,
      aspectRatio: null,
      construction: CONSTRUCTION.RADIAL,
      rimDiameter: null,
      loadIndexFront: null,
      loadIndexRear: null,
      speedRating: '',
      loadRange: '',
      plies: null,
      tireCondition: null,
      tireQuality: null,
      itemTypeCatalogId: 0,
      unitOfMeasureCatalogId: 0,
      vehicleTypeId: [],
    });
    this.selectedBrand.set(null);
    this.selectedProvider.set(null);
    this.selectedItemType.set(null);
    this.selectedUnitOfMeasure.set(null);
    this.selectedVehicleTypes.set([]);
  }

  setFormValue(product: Partial<Product>): void {
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
      speedRating: (product.tire?.speedRating ?? '') as SPEED_RATING | '',
      loadRange: product.tire?.loadRange ?? '',
      plies: product.tire?.plies ?? null,
      tireCondition: product.tire?.condition ?? null,
      tireQuality: product.tire?.quality ?? null,
      itemTypeCatalogId: product.itemTypeCatalogId ?? 0,
      unitOfMeasureCatalogId: product.unitOfMeasureCatalogId ?? 0,
    });
    // Cargar tipos de vehículo existentes (backend devuelve productVehicleType)
    const vehicleTypeId =
      product.productVehicleType
        ?.map((pvt) => pvt.vehicleType?.id)
        .filter((id: number) => id != null) ?? [];
    if (vehicleTypeId.length > 0) {
      this.selectedVehicleTypes.set(vehicleTypeId);
      this.tireForm.get('vehicleTypeId')?.setValue(vehicleTypeId);
    }
    // Cargar catálogos
    if (product.itemTypeCatalog) {
      this.selectedItemType.set({
        id: product.itemTypeCatalog.id,
        name: product.itemTypeCatalog.name,
      });
    }
    if (product.unitOfMeasureCatalog) {
      this.selectedUnitOfMeasure.set({
        id: product.unitOfMeasureCatalog.id,
        name: product.unitOfMeasureCatalog.name,
      });
    }
    this.selectedBrand.set(product.brand ? { id: product.brand.id, name: product.brand.name } : null);
    this.selectedProvider.set(product.provider ? { id: product.provider.id, name: product.provider.name } : null);
  }

  private originalSnapshot: Record<string, unknown> | null = null;

  private takeSnapshot(): void {
    const raw = this.tireForm.getRawValue() as Record<string, unknown>;
    this.originalSnapshot = JSON.parse(JSON.stringify(raw));
  }

  /** Dirty-only payload for edits: flat fields + nested tire. */
  private dirtyLike(): Partial<ProductTirePayload> {
    return buildDirtyLike<ProductTirePayload>({
      form: this.tireForm,
      originalSnapshot: this.originalSnapshot,
      isEditing: this.isEditing(),
      keys: [
        'notes',
        'salePrice',
        'purchasePrice',
        'brandId',
        'providerId',
      ],
      buildCreateLike: () => this.buildCreateLike(),
      postProcess: (like, { raw, original, same }) => {
        // Form control names do not always match the keys the backend DTO expects
        // inside `tire`: the condition is controlled as `tireCondition` but sent
        // as `condition`.
        const tireKeys: Record<string, string> = {
          prefix: 'prefix',
          width: 'width',
          aspectRatio: 'aspectRatio',
          construction: 'construction',
          rimDiameter: 'rimDiameter',
          loadIndexFront: 'loadIndexFront',
          loadIndexRear: 'loadIndexRear',
          speedRating: 'speedRating',
          loadRange: 'loadRange',
          plies: 'plies',
          tireCondition: 'condition',
          tireQuality: 'quality',
          vehicleTypeId: 'vehicleTypeId',
        };
        const numericTireKeys = new Set([
          'width',
          'aspectRatio',
          'rimDiameter',
          'loadIndexFront',
          'loadIndexRear',
          'plies',
        ]);
        // Optional numeric fields whose column is nullable: when cleared they are
        // sent as explicit null so the backend stores NULL.
        const optionalNumericTireKeys = new Set([
          'aspectRatio',
          'loadIndexFront',
          'loadIndexRear',
          'plies',
        ]);
        const enumTireKeys = new Set([
          'prefix',
          'construction',
          'loadRange',
          'speedRating',
          'tireQuality',
        ]);
        const toTirePayloadValue = (
          controlName: string,
          payloadKey: string,
        ): string | number | number[] | null | undefined => {
          const value = raw[controlName] as string | number | number[] | null;
          if (enumTireKeys.has(payloadKey)) {
            // Cleared optional enums are sent as null so the backend clears the
            // column (IsOptional lets null pass and the repository writes it).
            return value === '' ? null : value;
          }
          if (numericTireKeys.has(payloadKey)) {
            if (value === '' || value == null) {
              return optionalNumericTireKeys.has(payloadKey) ? null : undefined;
            }
            return Number(value);
          }
          return value;
        };
        const dirtyTire: Record<string, unknown> = {};
        for (const [controlName, payloadKey] of Object.entries(tireKeys)) {
          const control = this.tireForm.get(controlName);
          if (control?.dirty && !same(raw[controlName], original[controlName])) {
            dirtyTire[payloadKey] = toTirePayloadValue(controlName, payloadKey);
          }
        }
        if (Object.keys(dirtyTire).length > 0) {
          const tirePayload = dirtyTire as unknown as Partial<TireRequest>;
          like['tire'] = tirePayload;
        }
      },
    });
  }

  private buildCreateLike(): Partial<ProductTirePayload> {
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
      tireQuality,
      itemTypeCatalogId,
      unitOfMeasureCatalogId,
      vehicleTypeId,
    } = this.tireForm.value;

    return {
      notes,
      salePrice: salePrice!,
      purchasePrice: purchasePrice!,
      brandId,
      providerId: providerId ?? null,
      itemTypeCatalogId,
      unitOfMeasureCatalogId,
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
        quality: tireQuality ?? null,
        vehicleTypeId: vehicleTypeId ?? [],
      },
    };
  }

  hasChanges() {
    return !this.isEditing() || Object.keys(this.dirtyLike()).length > 0;
  }

  onSubmit(): void {
    if (this.isSubmitting()) return;
    this.tireForm.markAllAsTouched();
    if (this.tireForm.invalid) {
      const controls = this.tireForm.controls;
      if ([controls.providerId, controls.notes, controls.prefix, controls.loadRange,
        controls.loadIndexFront, controls.loadIndexRear, controls.speedRating,
        controls.plies].some(control => control.invalid)) this.optionalExpanded.set(true);
      return;
    }
    if (this.draftMode()) { this.draftSaved.emit(this.buildCreateLike()); this.closeModal(); return; }
    const tireLike = this.isEditing()
      ? this.dirtyLike()
      : this.buildCreateLike();
    if (this.isEditing() && Object.keys(tireLike).length === 0) {
      this.closeModal();
      return;
    }

    this.isSubmitting.set(true);

    if (this.isEditing()) {
      this.mutationUpdate.mutate({
        id: this.productId(),
        tireLike,
      });
    } else {
      this.mutationCreate.mutate(tireLike);
    }
  }
}
