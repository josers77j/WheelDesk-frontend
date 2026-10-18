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

import { CatalogService } from '../../../shared/services/catalog.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { FormErrorLabelComponent } from '../../../shared/components/form-error-label/form-error-label.component';
import { FormUtils } from '../../../shared/utils/form-utils';
import { Product, CatalogItem } from '../../interfaces/product.interface';
import { ProductService } from '../../services/product.service';
import { buildDirtyLike } from '../../utils/dirty-like';
import { ComboboxFormControlComponent } from '../../../shared/components/combobox-form-control/combobox-form-control.component';

import { invalidateCatalogCaches } from '../../../shared/utils/invalidate-catalog-caches.util';

interface productUpdateVars {
  id: number;
  serviceLike: Partial<Product>;
}

interface ServiceForm {
  name: FormControl<string | null>;
  notes: FormControl<string | null>;
  salePrice: FormControl<string | null>;
  taxType: FormControl<string | null>;
  unitOfMeasureCatalogId: FormControl<number | null>;
  itemTypeCatalogId: FormControl<number | null>;
}

@Component({
  selector: 'app-service-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, FormErrorLabelComponent, ComboboxFormControlComponent],
  templateUrl: './service-form-modal.component.html',
})
export class ServiceFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly productService = inject(ProductService);
  private readonly catalogService = inject(CatalogService);
  private readonly alertService = inject(AlertService);
  private readonly queryClient = inject(QueryClient);

  @ViewChild('formModal') formModal!: ElementRef<HTMLDialogElement>;

  saved = output<Product>();

  productId = signal<number>(0);
  /** Perezoso: catálogos solo cuando el modal se abre. */
  modalOpen = signal(false);
  isEditing = computed(() => this.productId() > 0);
  isSubmitting = signal<boolean>(false);

  serviceForm: FormGroup<ServiceForm> = this.fb.group({
    name: ['', [Validators.required]],
    notes: ['', []],
    salePrice: ['', []],
    taxType: ['', [Validators.required]],
    unitOfMeasureCatalogId: [0, [FormUtils.noSelected]],
    itemTypeCatalogId: [0, [FormUtils.noSelected]],
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
      this.applyDefaults();
    });
  }

  private applyDefaults() {
    if (this.isEditing()) return;
    const itemTypes = this.itemTypesQuery.data() ?? [];
    const units = this.unitOfMeasuresQuery.data() ?? [];
    if (
      !this.selectedItemType() &&
      !this.serviceForm.get('itemTypeCatalogId')?.value
    ) {
      const def = itemTypes.find((i) => i.name === 'Servicios');
      if (def) this.setItemType(def as never);
    }
    if (
      !this.selectedUnitOfMeasure() &&
      !this.serviceForm.get('unitOfMeasureCatalogId')?.value
    ) {
      const def = units.find((u) => u.name === 'Unidad');
      if (def) this.setUnitOfMeasure(def as never);
    }
  }

  selectedItemType = signal<CatalogItem | null>(null);
  selectedUnitOfMeasure = signal<CatalogItem | null>(null);

  setItemType(item: CatalogItem | null) {
    this.serviceForm.get('itemTypeCatalogId')?.setValue(item?.id ?? 0);
    this.serviceForm.get('itemTypeCatalogId')?.markAsDirty();
    this.selectedItemType.set(item);
  }

  setUnitOfMeasure(unit: CatalogItem | null) {
    this.serviceForm.get('unitOfMeasureCatalogId')?.setValue(unit?.id ?? 0);
    this.serviceForm.get('unitOfMeasureCatalogId')?.markAsDirty();
    this.selectedUnitOfMeasure.set(unit);
  }

  mutationCreate = injectMutation(() => ({
    mutationFn: (serviceLike: Partial<Product>) =>
      firstValueFrom(this.productService.createService(serviceLike)),
    onSuccess: (service) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['services'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Producto creado con éxito');
      this.saved.emit(service);
      this.closeModal();
    },
    onError: (exception): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  mutationUpdate = injectMutation(() => ({
    mutationFn: ({ id, serviceLike }: productUpdateVars) =>
      firstValueFrom(this.productService.updateService(id, serviceLike)),
    onSuccess: (service) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['services'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Producto actualizado con éxito');
      this.saved.emit(service);
      this.closeModal();
    },
    onError: (exception): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

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
    this.serviceForm.markAsPristine();
    this.serviceForm.markAsUntouched();
    this.takeSnapshot();
    this.formModal?.nativeElement?.showModal();
  }

  closeModal() {
    this.modalOpen.set(false);
    this.formModal?.nativeElement?.close();
    this.resetState();
  }

  private resetState() {
    this.productId.set(0);
    this.isSubmitting.set(false);
    this.selectedItemType.set(null);
    this.selectedUnitOfMeasure.set(null);
    this.serviceForm.reset({ name: '', notes: '', salePrice: '' });
  }

  setFormValue(product: Partial<Product>) {
    if (!product) return;
    this.serviceForm.patchValue({
      name: product.name ?? '',
      notes: product.notes ?? '',
      salePrice: product.salePrice ?? '',
      taxType: product.taxType ?? '',
      itemTypeCatalogId: product.itemTypeCatalogId ?? 0,
      unitOfMeasureCatalogId: product.unitOfMeasureCatalogId ?? 0,
    });
    // Cargar itemType y unitOfMeasure existentes
    if (product.itemTypeCatalog) {
      this.selectedItemType.set(product.itemTypeCatalog);
      this.serviceForm.get('itemTypeCatalogId')?.setValue(product.itemTypeCatalog.id);
    }
    if (product.unitOfMeasureCatalog) {
      this.selectedUnitOfMeasure.set(product.unitOfMeasureCatalog);
      this.serviceForm.get('unitOfMeasureCatalogId')?.setValue(product.unitOfMeasureCatalog.id);
    }
  }

  private originalSnapshot: Record<string, unknown> | null = null;

  private takeSnapshot(): void {
    const raw = this.serviceForm.getRawValue() as Record<string, unknown>;
    this.originalSnapshot = JSON.parse(JSON.stringify(raw));
  }

  /** Payload dirty-only en edicion: solo controles modificados. */
  private dirtyLike(): Partial<Product> {
    return buildDirtyLike<Product>({
      form: this.serviceForm,
      originalSnapshot: this.originalSnapshot,
      isEditing: this.isEditing(),
      keys: ['name', 'notes', 'salePrice', 'taxType', 'itemTypeCatalogId', 'unitOfMeasureCatalogId'],
      buildCreateLike: () => this.buildCreateLike(),
    });
  }

  private buildCreateLike(): Partial<Product> {
    const { name, notes, salePrice, taxType, itemTypeCatalogId, unitOfMeasureCatalogId } =
      this.serviceForm.value;

    return {
      name: name!,
      notes,
      salePrice: salePrice!,
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
    this.serviceForm.markAllAsTouched();
    if (this.serviceForm.invalid) return;
    const serviceLike = this.isEditing()
      ? this.dirtyLike()
      : this.buildCreateLike();
    if (this.isEditing() && Object.keys(serviceLike).length === 0) {
      this.closeModal();
      return;
    }

    this.isSubmitting.set(true);

    if (this.isEditing()) {
      this.mutationUpdate.mutate({
        id: this.productId(),
        serviceLike,
      });
    } else {
      this.mutationCreate.mutate(serviceLike);
    }
  }
}
