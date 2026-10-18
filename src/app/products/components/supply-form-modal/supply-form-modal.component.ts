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
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  QueryClient,
  injectMutation,
  injectQuery,
} from '@tanstack/angular-query-experimental';

import { BrandService } from '../../../brands/services/brand.service';
import { ProviderService } from '../../../providers/services/provider.service';
import { CatalogService } from '../../../shared/services/catalog.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { ValueParams } from '../../../shared/components/combobox/interfaces/search-param.interface';
import { ComboboxFormControlComponent } from '../../../shared/components/combobox-form-control/combobox-form-control.component';
import { FormErrorLabelComponent } from '../../../shared/components/form-error-label/form-error-label.component';
import { FormUtils } from '../../../shared/utils/form-utils';
import { Product, CatalogItem } from '../../interfaces/product.interface';
import { ProductService } from '../../services/product.service';
import { buildDirtyLike } from '../../utils/dirty-like';
import { invalidateCatalogCaches } from '../../../shared/utils/invalidate-catalog-caches.util';

interface productUpdateVars {
  id: number;
  supplyLike: Partial<Product>;
}

interface SupplyForm {
  name: FormControl<string | null>;
  notes: FormControl<string | null>;
  salePrice: FormControl<string | null>;
  purchasePrice: FormControl<string | null>;
  brandId: FormControl<number | null>;
  providerId: FormControl<number | null>;
  taxType: FormControl<string | null>;
  itemTypeCatalogId: FormControl<number | null>;
  unitOfMeasureCatalogId: FormControl<number | null>;
}

@Component({
  selector: 'app-supply-form-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormErrorLabelComponent,
    ComboboxFormControlComponent,
  ],
  templateUrl: './supply-form-modal.component.html',
})
export class SupplyFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly productService = inject(ProductService);
  private readonly brandService = inject(BrandService);
  private readonly providerService = inject(ProviderService);
  private readonly catalogService = inject(CatalogService);
  private readonly alertService = inject(AlertService);
  private readonly queryClient = inject(QueryClient);

  @ViewChild('formModal') formModal!: ElementRef<HTMLDialogElement>;

  saved = output<Product>();
  readonly draftSaved = output<Partial<Product>>();
  readonly draftMode = signal(false);
  readonly draftBrandName = signal('');

  productId = signal<number>(0);
  /** Perezoso: catálogos solo cuando el modal se abre. */
  modalOpen = signal(false);
  isEditing = computed(() => this.productId() > 0);
  isSubmitting = signal<boolean>(false);

  supplyForm: FormGroup<SupplyForm> = this.fb.group({
    name: ['', [Validators.required]],
    notes: ['', []],
    salePrice: ['', [Validators.required]],
    purchasePrice: ['', [Validators.required]],
    brandId: [0, [Validators.required, FormUtils.noSelected]],
    providerId: [0, []],
    taxType: ['', [Validators.required]],
    itemTypeCatalogId: [0, [FormUtils.noSelected]],
    unitOfMeasureCatalogId: [0, [FormUtils.noSelected]],
  });

  // ---------- Brand / Provider combobox ----------
  readonly limit = 100;

  private readonly originalBrandValidator = this.supplyForm.controls.brandId.validator;

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
    this.supplyForm.get('brandId')?.setValue(brand?.id ?? null);
    this.supplyForm.get('brandId')?.markAsDirty();
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
    this.supplyForm.get('providerId')?.setValue(provider?.id ?? null);
    this.supplyForm.get('providerId')?.markAsDirty();
    this.selectedProvider.set(provider);
  }

  placeholderInput = signal<{ provider: string; brand: string }>({
    provider: 'proveedor',
    brand: 'marca',
  });

  // ---------- Catalog comboboxes ----------
  unitSearch = signal('');
  /** Perezoso: pide al interactuar con su combobox. */
  unitTouched = signal(false);

  itemTypesQuery = injectQuery(() => ({
    queryKey: ['item-types'],
    queryFn: () => firstValueFrom(this.catalogService.getCatalog('item-type')),
    staleTime: 5000 * 60,
    enabled: this.modalOpen(),
  }));

  unitOfMeasuresQuery = injectQuery(() => ({
    queryKey: ['unit-of-measures', this.unitSearch()],
    queryFn: () =>
      firstValueFrom(
        this.catalogService.getCatalog('unit-of-measure', this.unitSearch() || undefined),
      ),
    staleTime: 5000 * 60,
    enabled: this.unitTouched(),
  }));

  constructor() {
    // Valores por defecto solo al crear: Servicios + Unidad.
    effect(() => {
      this.itemTypesQuery.data();
      this.unitOfMeasuresQuery.data();
      if (this.modalOpen() && this.draftMode()) {
        const unit = this.unitOfMeasuresQuery.data()?.find(value => value.id === this.supplyForm.controls.unitOfMeasureCatalogId.value);
        const item = this.itemTypesQuery.data()?.find(value => value.id === this.supplyForm.controls.itemTypeCatalogId.value);
        if (unit && this.selectedUnitOfMeasure()?.id !== unit.id) this.selectedUnitOfMeasure.set({ id: unit.id, name: unit.name, code: unit.code ?? undefined });
        if (item && this.selectedItemType()?.id !== item.id) this.selectedItemType.set({ id: item.id, name: item.name, code: item.code ?? undefined });
      }
      this.applyDefaults();
    });
  }

  private applyDefaults() {
    if (this.isEditing()) return;
    const itemTypes = this.itemTypesQuery.data() ?? [];
    const units = this.unitOfMeasuresQuery.data() ?? [];
    if (
      !this.selectedItemType() &&
      !this.supplyForm.get('itemTypeCatalogId')?.value
    ) {
      const def = itemTypes.find((i) => i.name === 'Servicios');
      if (def) this.setItemType(def as never);
    }
    if (
      !this.selectedUnitOfMeasure() &&
      !this.supplyForm.get('unitOfMeasureCatalogId')?.value
    ) {
      const def = units.find((u) => u.name === 'Unidad');
      if (def) this.setUnitOfMeasure(def as never);
    }
  }

  selectedItemType = signal<CatalogItem | null>(null);
  selectedUnitOfMeasure = signal<CatalogItem | null>(null);

  setItemType(item: CatalogItem | null) {
    this.supplyForm.get('itemTypeCatalogId')?.setValue(item?.id ?? 0);
    this.supplyForm.get('itemTypeCatalogId')?.markAsDirty();
    this.selectedItemType.set(item);
  }

  private readonly preparedUnits = new Map<number, CatalogItem>();

  setUnitOfMeasure(unit: CatalogItem | null) {
    if (unit) this.preparedUnits.set(unit.id, { ...unit });
    this.supplyForm.get('unitOfMeasureCatalogId')?.setValue(unit?.id ?? 0);
    this.supplyForm.get('unitOfMeasureCatalogId')?.markAsDirty();
    this.selectedUnitOfMeasure.set(unit);
  }

  // ---------- Mutations ----------
  mutationCreate = injectMutation(() => ({
    mutationFn: (supplyLike: Partial<Product>) =>
      firstValueFrom(this.productService.createSupply(supplyLike)),
    onSuccess: (supply) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['supplies'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Producto creado con éxito');
      this.saved.emit(supply);
      this.closeModal();
    },
    onError: (exception): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  mutationUpdate = injectMutation(() => ({
    mutationFn: ({ id, supplyLike }: productUpdateVars) =>
      firstValueFrom(this.productService.updateSupply(id, supplyLike)),
    onSuccess: (supply) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['supplies'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Producto actualizado con éxito');
      this.saved.emit(supply);
      this.closeModal();
    },
    onError: (exception): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  // ---------- Modal API ----------
  openForDraft(payload: Partial<Product>, brandName: string): void {
    this.resetState(); this.draftMode.set(true); this.draftBrandName.set(brandName);
    this.supplyForm.controls.purchasePrice.removeValidators(Validators.required);
    this.supplyForm.controls.purchasePrice.updateValueAndValidity();
    this.supplyForm.controls.brandId.clearValidators(); this.supplyForm.controls.brandId.updateValueAndValidity();
    this.setFormValue({...payload,providerId:null,brandId:null});
    this.supplyForm.patchValue({taxType:payload.taxType??'TAXABLE'});
    this.selectedUnitOfMeasure.set(payload.unitOfMeasureCatalogId
      ? this.preparedUnits.get(payload.unitOfMeasureCatalogId) ?? null
      : null);
    this.unitTouched.set(!!payload.unitOfMeasureCatalogId);
    this.modalOpen.set(true); this.formModal?.nativeElement.showModal();
  }

  openForCreate() {
    this.modalOpen.set(true);
    this.resetState();
    this.applyDefaults();
    this.takeSnapshot();
    this.formModal?.nativeElement?.showModal();
  }

  openForEdit(product: Product) {
    this.modalOpen.set(true);
    this.resetState();
    this.productId.set(product.id);
    this.setFormValue(product);
    this.supplyForm.markAsPristine();
    this.supplyForm.markAsUntouched();
    this.takeSnapshot();
    this.formModal?.nativeElement?.showModal();
  }

  closeModal() {
    this.modalOpen.set(false);
    this.formModal?.nativeElement?.close();
    this.resetState();
  }

  private resetState(): void {
    this.brandTouched.set(false);
    this.providerTouched.set(false);
    this.unitTouched.set(false);
    this.brandComboboxOutput.set('');
    this.providerComboboxOutput.set('');
    this.unitSearch.set('');
    this.draftMode.set(false); this.draftBrandName.set('');
    this.supplyForm.controls.purchasePrice.addValidators(Validators.required);
    this.supplyForm.controls.purchasePrice.updateValueAndValidity();
    this.supplyForm.controls.brandId.setValidators(this.originalBrandValidator);
    this.supplyForm.controls.brandId.updateValueAndValidity();
    this.productId.set(0);
    this.isSubmitting.set(false);
    this.selectedItemType.set(null);
    this.selectedUnitOfMeasure.set(null);
    this.supplyForm.reset({
      name: '',
      notes: '',
      salePrice: '',
      purchasePrice: '',
      brandId: 0,
      providerId: 0,
    });
    this.selectedBrand.set(null);
    this.selectedProvider.set(null);
  }

  setFormValue(product: Partial<Product>) {
    if (!product) return;
    this.supplyForm.patchValue({
      name: product.name ?? '',
      notes: product.notes ?? '',
      salePrice: product.salePrice ?? '',
      purchasePrice: product.purchasePrice ?? '',
      brandId: product.brandId ?? null,
      providerId: product.providerId ?? null,
      taxType: product.taxType ?? '',
      itemTypeCatalogId: product.itemTypeCatalogId ?? 0,
      unitOfMeasureCatalogId: product.unitOfMeasureCatalogId ?? 0,
    });
    // Cargar itemType y unitOfMeasure existentes
    if (product.itemTypeCatalog) {
      this.selectedItemType.set(product.itemTypeCatalog);
      this.supplyForm.get('itemTypeCatalogId')?.setValue(product.itemTypeCatalog.id);
    }
    if (product.unitOfMeasureCatalog) {
      this.selectedUnitOfMeasure.set(product.unitOfMeasureCatalog);
      this.supplyForm.get('unitOfMeasureCatalogId')?.setValue(product.unitOfMeasureCatalog.id);
    }
    this.selectedBrand.set(product.brand ? { id: product.brand.id, name: product.brand.name } : null);
    this.selectedProvider.set(product.provider ? { id: product.provider.id, name: product.provider.name } : null);
  }

  private originalSnapshot: Record<string, unknown> | null = null;

  private takeSnapshot(): void {
    const raw = this.supplyForm.getRawValue() as Record<string, unknown>;
    this.originalSnapshot = JSON.parse(JSON.stringify(raw));
  }

  /** Payload dirty-only en edicion: solo controles modificados. */
  private dirtyLike(): Partial<Product> {
    return buildDirtyLike<Product>({
      form: this.supplyForm,
      originalSnapshot: this.originalSnapshot,
      isEditing: this.isEditing(),
      keys: [
        'name',
        'notes',
        'salePrice',
        'purchasePrice',
        'brandId',
        'providerId',
        'taxType',
        'itemTypeCatalogId',
        'unitOfMeasureCatalogId',
      ],
      buildCreateLike: () => this.buildCreateLike(),
      // providerId marcado dirty pero sin cambio efectivo (p. ej. limpiado
      // desde un combobox): viaja explícito como null para borrar el valor.
      postProcess: (like, { raw }): void => {
        if (like['providerId'] === undefined && this.supplyForm.get('providerId')?.dirty) {
          like['providerId'] = raw['providerId'] ?? null;
        }
      },
    });
  }

  private buildCreateLike(): Partial<Product> {
    const { name, notes, salePrice, purchasePrice, brandId, providerId, taxType, itemTypeCatalogId, unitOfMeasureCatalogId } =
      this.supplyForm.value;

    return {
      name: name!,
      notes,
      salePrice: salePrice!,
      purchasePrice: purchasePrice!,
      brandId,
      providerId: providerId ?? null,
      taxType: taxType!,
      itemTypeCatalogId: itemTypeCatalogId!,
      unitOfMeasureCatalogId: unitOfMeasureCatalogId!,
    };
  }

  hasChanges() {
    return !this.isEditing() || Object.keys(this.dirtyLike()).length > 0;
  }

  onSubmit(): void {
    if (this.isSubmitting()) return;
    this.supplyForm.markAllAsTouched();
    if (this.supplyForm.invalid) return;
    if (this.draftMode()) { this.draftSaved.emit(this.buildCreateLike()); this.closeModal(); return; }
    const supplyLike = this.isEditing()
      ? this.dirtyLike()
      : this.buildCreateLike();
    if (this.isEditing() && Object.keys(supplyLike).length === 0) {
      this.closeModal();
      return;
    }

    this.isSubmitting.set(true);

    if (this.isEditing()) {
      this.mutationUpdate.mutate({
        id: this.productId(),
        supplyLike,
      });
    } else {
      this.mutationCreate.mutate(supplyLike);
    }
  }
}
