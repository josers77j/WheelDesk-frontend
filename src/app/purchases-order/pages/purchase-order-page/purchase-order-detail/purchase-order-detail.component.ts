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
import {
  ProductDetail,
  PurchaseOrder,
  PurchaseOrderDetail,
} from '../../../interfaces/purchase-order.interface';
import { CurrencyPipe, Location } from '@angular/common';
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
import { PurchaseOrderService } from '../../../services/purchase-order.service';
import { AlertService } from '../../../../shared/components/alert/alert.service';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ApproveModalComponent } from '../../../components/approve-modal/approve-modal.component';
import { FormErrorLabelComponent } from '../../../../shared/components/form-error-label/form-error-label.component';
import { firstValueFrom } from 'rxjs';
import { ValueParams } from '../../../../shared/components/combobox/interfaces/search-param.interface';
import { ProviderService } from '../../../../providers/services/provider.service';
import { ZoneService } from '../../../../zones/services/zone.service';
import { WarehouseService } from '../../../../warehouses/services/warehouse.service';
import { PURCHASE_ORDER_STATUS } from '../../../enums/purchase-order-status.enum';
import { ComboboxFormControlComponent } from '../../../../shared/components/combobox-form-control/combobox-form-control.component';
import { ProductService } from '../../../../products/services/product.service';
import Decimal from 'decimal.js';
import { FormUtils } from '../../../../shared/utils/form-utils';
import { toSignal } from '@angular/core/rxjs-interop';
import { invalidateCatalogCaches } from '../../../../shared/utils/invalidate-catalog-caches.util';
import { saveProductLine } from '../../../../shared/utils/product-line-save';

import { TireFormModalComponent } from '../../../../products/components/tire-form-modal/tire-form-modal.component';
import { SupplyFormModalComponent } from '../../../../products/components/supply-form-modal/supply-form-modal.component';
import { Product } from '../../../../products/interfaces/product.interface';

type ProductFormGroup = FormGroup<{
  productId: FormControl<number>;
  name: FormControl<string>;
  quantity: FormControl<number>;
  unitPrice: FormControl<string>;
  subtotal: FormControl<string>;
  suggestedZoneId: FormControl<number | null>;
  suggestedZoneName: FormControl<string | null>;
}>;

export interface PurchaseOrderUpdateVars {
  id: number;
  purchaseOrderLike: Partial<PurchaseOrderDetail>;
}

@Component({
  selector: 'app-purchase-order-detail',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    ApproveModalComponent,
    FormErrorLabelComponent,
    ComboboxFormControlComponent,
    CurrencyPipe,
    TireFormModalComponent,
    SupplyFormModalComponent,
  ],
  templateUrl: './purchase-order-detail.component.html',
})
export class PurchaseOrderDetailComponent implements OnInit {
  constructor(private readonly location: Location) {}

  purchaseOrder = input.required<PurchaseOrder>();

  /** Solo las órdenes PENDING se pueden editar; el resto es solo lectura. */
  isEditable = computed(
    () => this.purchaseOrder().status === PURCHASE_ORDER_STATUS.PENDING,
  );

  fb = inject(FormBuilder);
  queryClient = inject(QueryClient);
  router = inject(Router);
  providerService = inject(ProviderService);
  zoneService = inject(ZoneService);
  warehouseService = inject(WarehouseService);
  //alert signal
  wasSave = signal(false);

  purchaseOrderService = inject(PurchaseOrderService);
  alertService = inject(AlertService);
  productService = inject(ProductService);

  isLoading = signal<boolean>(false);

  formUtils = FormUtils;

  purchaseOrderForm = this.fb.group({
    providerId: [0, [Validators.required, this.formUtils.noSelected]],
    details: this.fb.array<ProductFormGroup>([], {
      validators: Validators.minLength(1),
    }),
  });

  get detailsArray() {
    return this.purchaseOrderForm.get('details') as FormArray;
  }

  private originalValue: unknown = null;

  hasChanges() {
    return FormUtils.hasChanges(this.purchaseOrderForm, this.originalValue);
  }

  productForm = this.fb.group({
    productId: [0, [Validators.required, this.formUtils.noSelected]],
    quantity: [0, [Validators.required, Validators.min(1), Validators.pattern(/^[0-9]+$/)]],
    unitPrice: ['0', [Validators.required, Validators.min(0.01)]],
    name: ['', [Validators.required]],
    suggestedZoneId: this.fb.control<number | null>(null),
    suggestedZoneName: this.fb.control<string | null>(null),
  });

  onSubmit(): void {
    if (this.isLoading()) return;
    if (!this.isEditable()) return;
    this.purchaseOrderForm.markAllAsTouched();

    const isDirty = this.hasChanges();
    const isValid = this.purchaseOrderForm.valid;

    if (!isDirty) return;
    if (!isValid) return;

    if (this.detailsArray.length === 0) {
      this.alertService.showError('Debe agregar al menos un producto');
      return;
    }

    const id = this.purchaseOrder().id;

    const { providerId, details } = this.purchaseOrderForm.value;

    const purchaseOrderLike: Partial<PurchaseOrderDetail> = {
      providerId: providerId!,
      details,
    };
    this.isLoading.set(true);
    if (id === 0) {
      this.mutationCreate.mutate(purchaseOrderLike);
    } else {
      this.mutationUpdate.mutate({
        id,
        purchaseOrderLike,
      });
    }

    this.queryClient.invalidateQueries({ queryKey: ['supplies'] });

    invalidateCatalogCaches(this.queryClient);
    this.queryClient.invalidateQueries({ queryKey: ['tires'] });
    invalidateCatalogCaches(this.queryClient);
  }

  // Mutations (Create / Update)
  mutationCreate = injectMutation(() => ({
    mutationFn: (purchaseOrderLike: Partial<PurchaseOrderDetail>) =>
      firstValueFrom(
        this.purchaseOrderService.createPurchaseOrder(purchaseOrderLike),
      ),
    onSuccess: (purchaseOrder) => {
      this.queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      this.alertService.showSuccess('Orden de compra creada con éxito');
      this.isLoading.set(false);
      // La orden queda PENDING: preguntar si se aprueba ahora o luego.
      this.createdOrderId.set(purchaseOrder.id);
      this.isNewOrder.set(true);
      this.approveChoiceDialog()?.nativeElement.showModal();
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  mutationUpdate = injectMutation(() => ({
    mutationFn: ({ id, purchaseOrderLike }: PurchaseOrderUpdateVars) =>
      firstValueFrom(
        this.purchaseOrderService.updatePurchaseOrder(id, purchaseOrderLike),
      ),
    onSuccess: () => {
      this.queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      // El preview de zonas se cachea por orden (`staleTime` 5min): sin
      // reventarlo, la vista previa sigue pintando las zonas anteriores.
      this.queryClient.invalidateQueries({
        queryKey: ['purchase-order-zone-preview'],
      });
      this.isLoading.set(false);
      this.alertService.showSuccess('Orden de compra actualizada con éxito');
      this.originalValue = this.purchaseOrderForm.getRawValue();
      // La orden sigue PENDING: preguntar si se aprueba ahora o luego.
      this.createdOrderId.set(this.purchaseOrder().id);
      this.isNewOrder.set(false);
      this.approveChoiceDialog()?.nativeElement.showModal();
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  resetProductForm() {
    this.productForm.reset();
    this.selectedProduct.set(null);
    this.selectedZone.set(null);
    this.selectedPurchaseWarehouse.set(null);
  }

  onSaveProduct(): void {
    const outcome = saveProductLine<ProductDetail>({
      productForm: this.productForm,
      selectedIndex: this.selectedIndexProduct(),
      buildLine: () => {
        const {
          productId,
          quantity,
          unitPrice,
          name,
          suggestedZoneId,
          suggestedZoneName,
        } = this.productForm.value;
        if (
          productId == null ||
          quantity == null ||
          unitPrice == null ||
          name == null
        ) {
          return null;
        }
        const subtotal = new Decimal(quantity).times(new Decimal(unitPrice));
        return {
          quantity,
          unitPrice,
          subtotal: String(subtotal),
          productId,
          name,
          suggestedZoneId: suggestedZoneId ?? null,
          suggestedZoneName: suggestedZoneName ?? null,
        };
      },
      isDuplicate: (line, index) =>
        this.detailsArray.controls.some((item, controlIndex) => {
          if (controlIndex === index) return false;
          const sameProduct = item.get('productId')?.value === line.productId;
          const sameZone =
            (item.get('suggestedZoneId')?.value ?? null) ===
            (line.suggestedZoneId ?? null);
          return sameProduct && sameZone;
        }),
      duplicateMessage: 'El producto ya existe en la tabla con la misma zona',
      add: (line) => this.addProduct(line),
      update: (index, line) => this.updateProduct(index, line),
      showError: (message) => this.alertService.showError(message),
    });

    if (outcome !== 'saved') return;
    this.resetProductForm();
    this.selectedIndexProduct.set(null);
    this.alertService.showSuccess('Producto guardado con éxito');
  }

  addProduct(product: ProductDetail) {
    this.detailsArray.push(
      this.fb.group({
        ...product,
      }),
    );
    this.purchaseOrderForm.markAsDirty();
  }

  updateProduct(index: number, product: ProductDetail) {
    this.detailsArray.at(index).patchValue({
      ...product,
    });
    this.purchaseOrderForm.markAsDirty();
  }

  onDeleteProduct(index: number) {
    this.selectedIndexProduct.set(null);

    this.detailsArray.removeAt(index);
    this.purchaseOrderForm.markAsDirty();
  }

  // Provider Section
  selectedProvider = signal<ValueParams | null>(null);
  limit = 5;
  setProvider(provider: ValueParams | null) {
    this.purchaseOrderForm.get('providerId')?.setValue(provider?.id ?? null);
    this.purchaseOrderForm.get('providerId')?.markAsDirty();
    this.selectedProvider.set(provider);
  }
  providerComboboxOutput = signal<string>('');
  /** Perezoso: pide al interactuar con su combobox. */
  providerTouched = signal(false);

  providersQuery = injectQuery(() => ({

    enabled: this.providerTouched(),
    queryKey: ['provider-combobox', this.providerComboboxOutput()],

    queryFn: () =>
      firstValueFrom(
        this.providerService.getProviderByName(
          this.limit,
          this.providerComboboxOutput(),
        ),
      ),
    staleTime: 5000 * 60,
  }));

  dialog = viewChild<ElementRef<HTMLDialogElement>>('productModal');

  // "¿Aprobar ahora o luego?" tras crear o editar la orden.
  createdOrderId = signal<number | null>(null);
  isNewOrder = signal(false);
  orderToApprove = signal<PurchaseOrder | null>(null);
  approveChoiceDialog = viewChild<ElementRef<HTMLDialogElement>>('approveChoiceModal');
  approveModalRef = viewChild(ApproveModalComponent);

  onApproveLater() {
    const id = this.createdOrderId();
    const isNew = this.isNewOrder();
    this.approveChoiceDialog()?.nativeElement.close();
    this.createdOrderId.set(null);
    // Al editar ya estamos en la orden: solo cerrar. Al crear: ir al detalle.
    if (isNew) {
      this.router.navigate(['/purchase-orders/detail', id]);
    }
  }

  async onApproveNow() {
    const id = this.createdOrderId();
    this.approveChoiceDialog()?.nativeElement.close();
    if (!id) return;
    try {
      const order = await firstValueFrom(
        this.purchaseOrderService.getPurchaseOrder(id),
      );
      this.orderToApprove.set(order);
      this.approveModalRef()?.openModal();
    } catch {
      this.alertService.showError('Error: no se pudo cargar la orden creada');
      this.router.navigate(['/purchase-orders/detail', id]);
    }
  }

  onApprovedNow() {
    this.createdOrderId();
    this.createdOrderId.set(null);
    this.orderToApprove.set(null);
    // La orden ya quedó aprobada: salir al listado, no quedarse en el detalle.
    this.router.navigate(['/purchase-orders/list']);
  }

  openModal(): void {
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

  onChangeIdProduct(id: number | null) {
    this.selectedIndexProduct.update(() => {
      if (this.selectedIndexProduct() === id) return null;

      return id;
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

    this.lastProductId.set(selectedIndex);

    this.productForm.patchValue({
      productId: detail.value?.productId,
      name: detail.value?.name,
      quantity: detail.value?.quantity,
      unitPrice: String(detail.value?.unitPrice),
      suggestedZoneId: detail.value?.suggestedZoneId ?? null,
      suggestedZoneName: detail.value?.suggestedZoneName ?? null,
    });

    const productParam: ValueParams = {
      id: productId,
      name,
    };

    this.selectedProduct.set(productParam);

    const zoneId = detail.value?.suggestedZoneId ?? null;
    this.selectedZone.set(
      zoneId === null
        ? null
        : {
            id: zoneId,
            name: detail.value?.suggestedZoneName ?? '',
          },
    );
  }

  tireCreateModal = viewChild(TireFormModalComponent);
  supplyCreateModal = viewChild(SupplyFormModalComponent);

  openProductCreate(): void {
    if (!this.isEditable() || this.selectedIndexProduct() !== null) return;
    if (this.purchaseProductTypeFilter() === 'TIRE') {
      this.tireCreateModal()?.openForCreate();
    } else {
      this.supplyCreateModal()?.openForCreate();
    }
  }

  onProductCreated(product: Pick<Product, 'id' | 'name' | 'type'>): void {
    if (!this.isEditable() || this.selectedIndexProduct() !== null) return;
    if (product.type !== 'TIRE' && product.type !== 'SUPPLY') return;
    this.purchaseProductTypeFilter.set(product.type);
    this.setProduct({ id: product.id, name: product.name });
    invalidateCatalogCaches(this.queryClient);
  }

  lastProductId = signal<number | null>(null);

  selectedProduct = signal<ValueParams | null>(null);

  setProduct(product: ValueParams | null) {
    const changed = product?.id !== this.selectedProduct()?.id;
    this.productForm.get('productId')?.setValue(product?.id ?? null);
    this.productForm.get('name')?.setValue(product?.name ?? null);
    this.productForm.get('productId')?.markAsDirty();
    this.selectedProduct.set(product);
    // Cascada: cambió el producto, bodega y zona se limpian.
    if (changed || !product) {
      this.selectedPurchaseWarehouse.set(null);
      this.setZone(null);
    }
  }
  productComboboxOutput = signal<string>('');
  /** Perezoso: pide al interactuar con su combobox. */
  productTouched = signal(false);

  /** Compras: solo llantas y suministros (sin servicios). */
  purchaseProductTypeFilter = signal<'TIRE' | 'SUPPLY'>('TIRE');
  setPurchaseProductTypeFilter(value: 'TIRE' | 'SUPPLY') {
    this.purchaseProductTypeFilter.set(value);
  }

  productsQuery = injectQuery(() => ({

    enabled: this.productTouched(),
    queryKey: [
      'product-combobox',
      this.productComboboxOutput(),
      this.purchaseProductTypeFilter(),
    ],

    queryFn: () =>
      firstValueFrom(
        this.productService.getSummaryByName(
          this.productComboboxOutput(),
          undefined,
          this.purchaseProductTypeFilter(),
        ),
      ),
    staleTime: 5000 * 60,
  }));

  /** Stock actual del producto elegido (el summary ahora trae stock). */
  selectedProductStock = computed(
    () =>
      (this.productsQuery.data() ?? []).find(
        (item) => item.id === this.selectedProduct()?.id,
      )?.stock ?? null,
  );

  // Zone Section (zona sugerida, opcional por línea)
  selectedZone = signal<ValueParams | null>(null);
  selectedPurchaseWarehouse = signal<ValueParams | null>(null);
  warehouseComboboxOutput = signal<string>('');
  /** Perezoso: pide al interactuar con su combobox. */
  warehouseTouched = signal(false);
  zoneComboboxOutput = signal<string>('');
  /** Perezoso: pide al interactuar con su combobox. */
  zoneTouched = signal(false);

  warehousesQuery = injectQuery(() => ({

    enabled: this.warehouseTouched(),
    // Compras reponen: sin filtro de producto (la zona destino puede estar vacía).
    queryKey: ['warehouse-combobox', this.warehouseComboboxOutput()],
    queryFn: () =>
      firstValueFrom(
        this.warehouseService.searchWarehousesByName(
          5,
          this.warehouseComboboxOutput(),
        ),
      ),
    staleTime: 5000 * 60,
  }));

  zonesQuery = injectQuery(() => ({

    enabled: this.zoneTouched(),
    queryKey: [
      'zone-combobox',
      this.zoneComboboxOutput(),
      this.selectedPurchaseWarehouse()?.id ?? null,
    ],

    queryFn: () =>
      firstValueFrom(
        this.zoneService.getZonesByName(
          this.limit,
          this.zoneComboboxOutput(),
          undefined,
          this.selectedPurchaseWarehouse()?.id ?? undefined,
        ),
      ),
    staleTime: 5000 * 60,
  }));

  setPurchaseWarehouse(warehouse: ValueParams | null) {
    this.selectedPurchaseWarehouse.set(warehouse);
    // Cascada: cambia la bodega, se limpia la zona sugerida.
    this.setZone(null);
  }

  setZone(zone: ValueParams | null) {
    this.productForm.get('suggestedZoneId')?.setValue(zone?.id ?? null);
    this.productForm.get('suggestedZoneName')?.setValue(zone?.name ?? null);
    this.productForm.get('suggestedZoneId')?.markAsDirty();
    this.selectedZone.set(zone);
  }

  ngOnInit() {
    this.setFormValue(this.purchaseOrder());
    if (!this.isEditable()) {
      this.purchaseOrderForm.disable();
      this.productForm.disable();
    }
  }

  setFormValue(purchaseOrder: Partial<PurchaseOrder>): void {
    if (!purchaseOrder) return;

    this.purchaseOrderForm.patchValue({
      providerId: purchaseOrder.providerId ?? null,
    });
    this.detailsArray.clear();
    purchaseOrder.details?.forEach((detail) => {
      this.detailsArray.push(
        this.fb.group({
          productId: detail.product.id,
          name: detail.product.name,
          quantity: detail.quantity,
          unitPrice: detail.unitPrice,
          subtotal: detail.subtotal,
          suggestedZoneId: detail.suggestedZoneId ?? null,
          suggestedZoneName: detail.suggestedZone
            ? `${detail.suggestedZone.warehouse.name} / ${detail.suggestedZone.name}`
            : null,
        }),
      );
    });

    const provider = purchaseOrder.provider;
    this.selectedProvider.set(provider ? { id: provider.id, name: provider.name } : null);
    this.originalValue = this.purchaseOrderForm.getRawValue();
  }

  detailsChanges = toSignal<ProductDetail[]>(this.detailsArray.valueChanges, {
    initialValue: this.detailsArray.value,
  });

  totalPurchaseOrder = computed(() => {
    const details = this.detailsChanges()!;
    return details
      .reduce((acc, product) => {
        acc = new Decimal(acc).plus(new Decimal(product.subtotal ?? 0));

        return acc;
      }, new Decimal(0))
      .toString();
  });

  // back to the previous page
  backToPreviusPage() {
    this.location.back();
  }
}
