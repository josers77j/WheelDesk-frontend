import { ReviewChecklistComponent, ReviewItem } from '../../../../shared/components/review-checklist/review-checklist.component';
import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Location } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  injectMutation,
  injectQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { Router } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';

import {
  CreateTransferPayload,
  Transfer,
} from '../../../interfaces/transfer.interface';
import { TransferService } from '../../../services/transfer.service';
import { ZoneService } from '../../../../zones/services/zone.service';
import { WarehouseService } from '../../../../warehouses/services/warehouse.service';
import { ProductService } from '../../../../products/services/product.service';
import { AlertService } from '../../../../shared/components/alert/alert.service';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { FormErrorLabelComponent } from '../../../../shared/components/form-error-label/form-error-label.component';
import { ComboboxFormControlComponent } from '../../../../shared/components/combobox-form-control/combobox-form-control.component';
import { ValueParams } from '../../../../shared/components/combobox/interfaces/search-param.interface';
import { FormUtils } from '../../../../shared/utils/form-utils';
import { saveProductLine } from '../../../../shared/utils/product-line-save';

type TransferProductFormGroup = FormGroup<{
  productId: FormControl<number>;
  name: FormControl<string>;
  quantity: FormControl<number>;
  zoneStock: FormControl<number | null>;
}>;

@Component({
  selector: 'app-transfer-detail',
  imports: [
    ReviewChecklistComponent,
    ReactiveFormsModule,
    AlertComponent,
    FormErrorLabelComponent,
    ComboboxFormControlComponent,
  ],
  templateUrl: './transfer-detail.component.html',
})
export class TransferDetailComponent implements OnInit {
  reviewItems(): readonly ReviewItem[] {
    return [
      { label: 'Zona de origen', complete: !!this.selectedFromZone(), touched: this.fromZoneTouched() || this.transferForm.touched },
      { label: 'Zona de destino', complete: !!this.selectedToZone() && this.transferForm.get('fromZoneId')?.value !== this.transferForm.get('toZoneId')?.value, touched: this.toZoneTouched() || this.transferForm.touched },
      { label: 'Productos y cantidades', complete: this.detailsArray.length > 0 && this.detailsArray.valid && this.transferForm.controls.details.controls.every(control => control.controls.zoneStock.value === null || control.controls.quantity.value <= control.controls.zoneStock.value), touched: this.detailsArray.dirty || this.detailsArray.touched },
    ];
  }
  constructor(private readonly location: Location) {}

  transfer = input.required<Transfer>();

  fb = inject(FormBuilder);
  queryClient = inject(QueryClient);
  router = inject(Router);
  transferService = inject(TransferService);
  zoneService = inject(ZoneService);
  warehouseService = inject(WarehouseService);
  productService = inject(ProductService);
  alertService = inject(AlertService);

  formUtils = FormUtils;
  isLoading = signal<boolean>(false);

  transferForm = this.fb.group({
    fromZoneId: [0, [Validators.required, this.formUtils.noSelected]],
    toZoneId: [0, [Validators.required, this.formUtils.noSelected]],
    details: this.fb.array<TransferProductFormGroup>([], {
      validators: Validators.minLength(1),
    }),
  });

  get detailsArray() {
    return this.transferForm.get('details') as FormArray;
  }

  private originalValue: unknown = null;

  hasChanges() {
    return FormUtils.hasChanges(this.transferForm, this.originalValue);
  }

  productForm = this.fb.group({
    productId: [0, [Validators.required, this.formUtils.noSelected]],
    quantity: [0, [Validators.required, Validators.min(1)]],
    name: ['', [Validators.required]],
  });

  onSubmit(): void {
    if (this.isLoading()) return;
    this.transferForm.markAllAsTouched();

    if (!this.hasChanges()) return;
    if (this.transferForm.invalid) return;

    if (this.detailsArray.length === 0) {
      this.alertService.showError('Debe agregar al menos un producto');
      return;
    }

    const id = this.transfer().id;
    const { fromZoneId, toZoneId, details } = this.transferForm.value;

    if (fromZoneId === toZoneId) {
      this.alertService.showError(
        'La zona de origen y destino deben ser diferentes',
      );
      return;
    }

    if (
      (details ?? []).some(
        (detail) =>
          detail.zoneStock !== null &&
          detail.quantity! > detail.zoneStock!,
      )
    ) {
      this.alertService.showError(
        'No puedes transferir más unidades que el stock disponible en el origen',
      );
      return;
    }

    const detailMapped = (details ?? []).map((detail) => ({
      productId: detail.productId!,
      quantity: detail.quantity!,
    }));

    this.isLoading.set(true);
    if (id === 0) {
      const payload: CreateTransferPayload = {
        fromZoneId: fromZoneId!,
        toZoneId: toZoneId!,
        details: detailMapped,
      };
      this.mutationCreate.mutate(payload);
    } else {
      this.mutationUpdate.mutate({ id, details: detailMapped });
    }
  }

  mutationCreate = injectMutation(() => ({
    mutationFn: (payload: CreateTransferPayload) =>
      firstValueFrom(this.transferService.createTransfer(payload)),
    onSuccess: () => {
      this.queryClient.invalidateQueries({ queryKey: ['transfers'] });
      this.alertService.showSuccess('Transferencia realizada con éxito');
      this.isLoading.set(false);
      this.router.navigate(['/transfers']);
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  mutationUpdate = injectMutation(() => ({
    mutationFn: ({
      id,
      details,
    }: {
      id: number;
      details: { productId: number; quantity: number }[];
    }) => firstValueFrom(this.transferService.updateTransfer(id, details)),
    onSuccess: () => {
      this.queryClient.invalidateQueries({ queryKey: ['transfers'] });
      this.alertService.showSuccess('Transferencia actualizada con éxito');
      this.isLoading.set(false);
      this.router.navigate(['/transfers']);
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  // Bodega de origen
  fromWarehouseComboboxOutput = signal<string>('');
  fromWarehouseTouched = signal(false);
  selectedFromWarehouse = signal<ValueParams | null>(null);
  fromWarehousesQuery = injectQuery(() => ({
    enabled: this.fromWarehouseTouched(),
    queryKey: [
      'transfer-from-warehouse-combobox',
      'IN_STOCK',
      this.fromWarehouseComboboxOutput(),
    ],
    queryFn: () =>
      firstValueFrom(
        this.warehouseService.searchWarehousesByName(
          this.limit,
          this.fromWarehouseComboboxOutput(),
          undefined,
          'IN_STOCK',
        ),
      ),
    staleTime: 5000 * 60,
  }));

  setFromWarehouse(warehouse: ValueParams | null) {
    const previousId = this.selectedFromWarehouse()?.id ?? 0;
    const nextId = warehouse?.id ?? 0;
    this.selectedFromWarehouse.set(warehouse);
    if (previousId !== nextId) {
      this.fromZoneComboboxOutput.set('');
      this.fromZoneTouched.set(false);
      this.setFromZone(null);
    }
  }

  // Bodega de destino
  toWarehouseComboboxOutput = signal<string>('');
  toWarehouseTouched = signal(false);
  selectedToWarehouse = signal<ValueParams | null>(null);
  toWarehousesQuery = injectQuery(() => ({
    enabled: this.toWarehouseTouched(),
    queryKey: [
      'transfer-to-warehouse-combobox',
      this.toWarehouseComboboxOutput(),
    ],
    queryFn: () =>
      firstValueFrom(
        this.warehouseService.searchWarehousesByName(
          this.limit,
          this.toWarehouseComboboxOutput(),
        ),
      ),
    staleTime: 5000 * 60,
  }));

  setToWarehouse(warehouse: ValueParams | null) {
    const previousId = this.selectedToWarehouse()?.id ?? 0;
    const nextId = warehouse?.id ?? 0;
    this.selectedToWarehouse.set(warehouse);
    if (previousId !== nextId) {
      this.toZoneComboboxOutput.set('');
      this.toZoneTouched.set(false);
      this.setToZone(null);
    }
  }

  // Zonas
  limit = 5;
  selectedFromZone = signal<ValueParams | null>(null);
  selectedToZone = signal<ValueParams | null>(null);
  fromZoneComboboxOutput = signal<string>('');
  /** Perezoso: pide al interactuar con su combobox. */
  fromZoneTouched = signal(false);
  toZoneComboboxOutput = signal<string>('');
  /** Perezoso: pide al interactuar con su combobox. */
  toZoneTouched = signal(false);

  fromZonesQuery = injectQuery(() => ({

    enabled: this.fromZoneTouched(),
    queryKey: [
      'from-zone-combobox',
      'IN_STOCK',
      this.selectedFromWarehouse()?.id ?? null,
      this.fromZoneComboboxOutput(),
    ],
    queryFn: () =>
      firstValueFrom(
        this.zoneService
          .getZonesByName(
            this.limit,
            this.fromZoneComboboxOutput(),
            'IN_STOCK',
            this.selectedFromWarehouse()?.id,
          )
          .pipe(map((zones) => this.zoneOptions(zones))),
      ),
    staleTime: 5000 * 60,
  }));

  toZonesQuery = injectQuery(() => ({

    enabled: this.toZoneTouched(),
    queryKey: [
      'to-zone-combobox',
      this.selectedToWarehouse()?.id ?? null,
      this.toZoneComboboxOutput(),
    ],
    queryFn: () =>
      firstValueFrom(
        this.zoneService
          .getZonesByName(
            this.limit,
            this.toZoneComboboxOutput(),
            undefined,
            this.selectedToWarehouse()?.id,
          )
          .pipe(map((zones) => this.zoneOptions(zones))),
      ),
    staleTime: 5000 * 60,
  }));

  private zoneOptions(zones: ValueParams[]): ValueParams[] {
    return zones.map((zone) => ({
      ...zone,
      name: this.zoneLabel(zone.name),
    }));
  }

  private zoneLabel(name: string): string {
    const separator = name.lastIndexOf(' / ');
    return separator >= 0 ? name.slice(separator + 3) : name;
  }

  setFromZone(zone: ValueParams | null) {
    const previousZoneId = this.selectedFromZone()?.id ?? 0;
    const nextZoneId = zone?.id ?? 0;
    this.transferForm.get('fromZoneId')?.setValue(nextZoneId);
    this.transferForm.get('fromZoneId')?.markAsDirty();
    if (this.selectedToZone()?.id === nextZoneId) {
      this.setToZone(null);
    }
    this.selectedFromZone.set(zone);
    if (previousZoneId !== nextZoneId) {
      this.clearTransferProducts();
    }
  }

  private clearTransferProducts() {
    this.detailsArray.clear();
    this.selectedIndexProduct.set(null);
    this.resetProductForm();
    this.productComboboxOutput.set('');
    this.productTouched.set(false);
    const modal = this.dialog()?.nativeElement;
    if (modal?.open) modal.close();
  }

  setToZone(zone: ValueParams | null) {
    if (zone && zone.id === this.selectedFromZone()?.id) {
      this.alertService.showError(
        'La zona de origen y destino deben ser diferentes',
      );
      return;
    }
    this.transferForm.get('toZoneId')?.setValue(zone?.id ?? 0);
    this.transferForm.get('toZoneId')?.markAsDirty();
    this.selectedToZone.set(zone);
  }

  // Productos
  dialog = viewChild<ElementRef<HTMLDialogElement>>('productModal');

  openModal(): void {
    if (!this.selectedFromZone()?.id) {
      this.alertService.showError(
        'Seleccione primero una zona de origen con stock',
      );
      return;
    }
    const dialog = this.dialog()?.nativeElement;
    if (!dialog) return;
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input[formControlName="quantity"]')
      ?.focus({ preventScroll: true });
  }

  closeModal() {
    this.dialog()!.nativeElement.close();
  }

  selectedIndexProduct = signal<number | null>(null);

  onChangeIdProduct(index: number | null) {
    this.selectedIndexProduct.update(() => {
      if (this.selectedIndexProduct() === index) return null;
      return index;
    });
  }

  clearProductSelection() {
    this.selectedIndexProduct.set(null);
  }

  onCreateSelected() {
    this.resetProductForm();
    this.selectedIndexProduct.set(null);
  }

  onModifySelected(): void {
    this.resetProductForm();

    const selectedIndex = this.selectedIndexProduct();

    if (selectedIndex === null) return;

    const detail = this.detailsArray.at(selectedIndex);
    if (!detail) return;
    const productId = detail.value.productId;
    const name = detail.value.name;
    if (productId == null || name == null) return;

    this.productForm.patchValue({
      productId: detail.value?.productId,
      name: detail.value?.name,
      quantity: detail.value?.quantity,
    });

    const productParam: ValueParams = {
      id: productId,
      name,
      zoneStock: detail.value?.zoneStock ?? undefined,
    };

    this.selectedProduct.set(productParam);
  }

  selectedProduct = signal<ValueParams | null>(null);

  setProduct(product: ValueParams | null) {
    this.productForm.get('productId')?.setValue(product?.id ?? null);
    this.productForm.get('name')?.setValue(product?.name ?? null);
    this.productForm.get('productId')?.markAsDirty();
    this.selectedProduct.set(product);
  }

  productComboboxOutput = signal<string>('');
  /** Perezoso: pide al interactuar con su combobox. */
  productTouched = signal(false);

  productsQuery = injectQuery(() => ({
    enabled: this.productTouched() && !!this.selectedFromZone()?.id,
    queryKey: [
      'transfer-product-combobox',
      this.selectedFromZone()?.id ?? null,
      this.productComboboxOutput(),
    ],
    queryFn: () =>
      firstValueFrom(
        this.productService.getSummaryByName(
          this.productComboboxOutput(),
          undefined,
          undefined,
          this.selectedFromZone()?.id,
        ),
      ),
    staleTime: 5000 * 60,
  }));

  zoneProductsQuery = injectQuery(() => ({
    enabled: !!this.selectedFromZone()?.id,
    queryKey: [
      'transfer-zone-products',
      this.selectedFromZone()?.id ?? null,
    ],
    queryFn: () =>
      firstValueFrom(
        this.productService.getSummaryByName(
          '',
          undefined,
          undefined,
          this.selectedFromZone()?.id,
          100,
        ),
      ),
    staleTime: 5000 * 60,
  }));

  selectZoneProduct(product: ValueParams) {
    this.resetProductForm();
    this.setProduct(product);
    this.productForm.get('quantity')?.setValue(1);
    this.openModal();
  }

  onSaveProduct(): void {
    const index = this.selectedIndexProduct();
    const outcome = saveProductLine<{
      productId: number;
      name: string;
      quantity: number;
      zoneStock: number | null;
    }>({
      productForm: this.productForm,
      selectedIndex: index,
      guard: () => {
        const availableStock = this.selectedProduct()?.zoneStock;
        const quantity = this.productForm.value.quantity;
        if (
          availableStock === undefined ||
          quantity == null ||
          quantity <= availableStock
        ) {
          return true;
        }
        this.alertService.showError(
          `Solo hay ${availableStock} unidades disponibles en el origen`,
        );
        return false;
      },
      buildLine: (selectedIndex) => {
        const { productId, quantity, name } = this.productForm.value;
        if (quantity == null || name == null) return null;
        let resolvedProductId = productId;
        if (selectedIndex !== null && resolvedProductId == null) {
          resolvedProductId =
            this.detailsArray.at(selectedIndex).get('productId')?.value ?? null;
        }
        if (typeof resolvedProductId !== 'number') return null;
        return {
          productId: resolvedProductId,
          name,
          quantity,
          zoneStock: this.selectedProduct()?.zoneStock ?? null,
        };
      },
      isDuplicate: (line, selectedIndex) =>
        selectedIndex === null &&
        this.detailsArray.controls.some(
          (item) => item.get('productId')?.value === line.productId,
        ),
      duplicateMessage: 'El producto ya existe en la tabla',
      add: (line) => this.addProduct(line),
      update: (selectedIndex, line) => this.updateProduct(selectedIndex, line),
      showError: (message) => this.alertService.showError(message),
    });

    if (outcome !== 'saved') return;
    this.onChangeIdProduct(index);
    this.resetProductForm();
    this.alertService.showSuccess('Producto guardado con éxito');
  }

  addProduct(product: {
    productId: number;
    name: string;
    quantity: number;
    zoneStock: number | null;
  }) {
    this.detailsArray.push(
      this.fb.group({
        productId: product.productId,
        name: product.name,
        quantity: product.quantity,
        zoneStock: product.zoneStock,
      }),
    );
  }

  updateProduct(
    index: number,
    product: {
      productId: number;
      name: string;
      quantity: number;
      zoneStock: number | null;
    },
  ) {
    this.detailsArray.at(index).patchValue({
      ...product,
    });
  }

  onDeleteProduct(index: number) {
    this.clearProductSelection();

    this.detailsArray.removeAt(index);
  }

  resetProductForm() {
    this.productForm.reset();
    this.selectedProduct.set(null);
  }

  ngOnInit() {
    this.setFormValue(this.transfer());
  }

  setFormValue(transfer: Partial<Transfer>): void {
    if (!transfer) return;

    this.transferForm.patchValue({
      fromZoneId: transfer.fromZoneId ?? null,
      toZoneId: transfer.toZoneId ?? null,
    });
    this.detailsArray.clear();
    transfer.details?.forEach((detail) => {
      this.detailsArray.push(
        this.fb.group({
          productId: detail.product.id,
          name: detail.product.name,
          quantity: detail.quantity,
          zoneStock: null,
        }),
      );
    });

    if (transfer.fromZone) {
      this.selectedFromZone.set({
        id: transfer.fromZone.id,
        name: this.zoneLabel(transfer.fromZone?.name ?? ''),
      });
    }
    if (transfer.toZone) {
      this.selectedToZone.set({
        id: transfer.toZone.id,
        name: this.zoneLabel(transfer.toZone?.name ?? ''),
      });
    }
    this.originalValue = this.transferForm.getRawValue();
  }

  isEditing = computed(() => this.transfer().id > 0);

  // back to the previous page
  backToPreviusPage() {
    this.location.back();
  }
}