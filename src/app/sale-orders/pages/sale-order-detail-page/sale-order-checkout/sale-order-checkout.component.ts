import { CustomerMissingInfoComponent } from '../../../../customers/components/customer-missing-info/customer-missing-info.component';
import { ProductEntryLayoutComponent } from '../../../../shared/components/product-entry-layout/product-entry-layout.component';
import { ReviewChecklistComponent, ReviewItem } from '../../../../shared/components/review-checklist/review-checklist.component';
import { PdfPreviewComponent } from '../../../../shared/components/pdf-preview/pdf-preview.component';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnInit,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
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
import { catchError, firstValueFrom, Subject, takeUntil } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { QuotationService } from '../../../../quotations/services/quotation.service';
import Decimal from 'decimal.js';
import { SaleOrderService } from '../../../services/sale-order.service';
import { CatalogService } from '../../../services/catalog.service';
import { CheckoutDraftService } from '../../../services/checkout-draft.service';
import { AlertService } from '../../../../shared/components/alert/alert.service';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ComboboxFormControlComponent } from '../../../../shared/components/combobox-form-control/combobox-form-control.component';
import { FormErrorLabelComponent } from '../../../../shared/components/form-error-label/form-error-label.component';
import { CustomerService } from '../../../../customers/services/customer.service';
import { ProductService } from '../../../../products/services/product.service';
import { ZoneService } from '../../../../zones/services/zone.service';
import { WarehouseService } from '../../../../warehouses/services/warehouse.service';
import { PRODUCT_TYPE } from '../../../../products/interfaces/product-type.enum';
import { ValueParams } from '../../../../shared/components/combobox/interfaces/search-param.interface';
import { CustomerFormModalComponent } from '../../../../customers/components/customer-form-modal/customer-form-modal.component';
import { Customer } from '../../../../customers/interfaces/customer.interface';
import { customerMissingFields } from '../../../../customers/utils/customer-missing-fields.util';
import { DeleteActionModalComponent } from '../../../../shared/components/delete-action-modal/delete-action-modal.component';
import { DeleteActionModalService } from '../../../../shared/components/delete-action-modal/deleteActionModal.service';
import { ConfirmActionModalComponent } from '../../../../shared/components/confirm-action-modal/confirm-action-modal.component';
import { invalidateCatalogCaches } from '../../../../shared/utils/invalidate-catalog-caches.util';
import {
  CheckoutDocumentType,
  DiscountType,
  DTE_CATALOG_CODES,
  type CatalogItem,
  type CheckoutDraftItem,
  type CheckoutDraftPayment,
  type CheckoutPayload,
} from '../../../interfaces/checkout.interface';

/** Origen del cliente de la orden: se elige uno existente o se crea uno. */
export type CheckoutCustomerMode = 'EXISTING' | 'NEW';

type CheckoutItemFormGroup = FormGroup<{
  productId: FormControl<number>;
  name: FormControl<string>;
  quantity: FormControl<number>;
  zoneId: FormControl<number>;
  zoneName: FormControl<string>;
  unitPrice: FormControl<number | null>;
  unitPriceEstimate: FormControl<string>;
  lineTotal: FormControl<string>;
  discountType: FormControl<DiscountType | null>;
  discountValue: FormControl<number | null>;
}>;

type CheckoutPaymentFormGroup = FormGroup<{
  paymentMethodId: FormControl<number | null>;
  amount: FormControl<number>;
}>;

@Component({
  selector: 'app-sale-order-checkout',
  imports: [
    CustomerMissingInfoComponent,
    ProductEntryLayoutComponent,
    ReviewChecklistComponent,
    ReactiveFormsModule,
    AlertComponent,
    ComboboxFormControlComponent,
    FormErrorLabelComponent,
    CurrencyPipe,
    CustomerFormModalComponent,
    DeleteActionModalComponent,
    ConfirmActionModalComponent,
    PdfPreviewComponent,
  ],
  templateUrl: './sale-order-checkout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleOrderCheckoutComponent implements OnInit, OnDestroy {
  constructor(private readonly location: Location) {}

  private readonly cdr = inject(ChangeDetectorRef, { optional: true });
  fb = inject(FormBuilder);
  queryClient = inject(QueryClient);
  router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly quotationService = inject(QuotationService);
  readonly quotationBannerDismissed = signal(false);
  readonly clearDraftDialog = viewChild<ElementRef<HTMLDialogElement>>('clearDraftDialog');
  readonly quotationSource = computed(() => this.draftService.draft().quotationId);
  saleOrderService = inject(SaleOrderService);
  catalogService = inject(CatalogService);
  draftService = inject(CheckoutDraftService);
  alertService = inject(AlertService);
  customerService = inject(CustomerService);
  productService = inject(ProductService);
  zoneService = inject(ZoneService);
  warehouseService = inject(WarehouseService);
  deleteModalService = inject(DeleteActionModalService);

  isLoading = signal(false);
  readonly attachmentFiles = signal<File[]>([]);
  readonly attachmentsComplete = computed(() => {
    const files = this.attachmentFiles();
    return files.length === 2 &&
      files.filter((file) => /\.pdf$/i.test(file.name)).length === 1 &&
      files.filter((file) => /\.json$/i.test(file.name)).length === 1;
  });
  readonly pdfViewer = viewChild(PdfPreviewComponent);
  readonly draggingAttachments = signal(false);
  readonly attachmentPreviewDialog = viewChild<ElementRef<HTMLDialogElement>>('attachmentPreviewDialog');
  readonly attachmentPreviewText = signal('');
  private attachmentPreviewRequest = 0;

  async previewAttachment(file: File): Promise<void> {
    this.closeAttachmentPreview();
    if (/\.pdf$/i.test(file.name)) {
      await this.pdfViewer()?.open(file, 'Factura de venta');
      return;
    }
    const request = this.attachmentPreviewRequest;
    let text: string;
    try {
      text = JSON.stringify(JSON.parse(await file.text()), null, 2);
    } catch {
      text = 'El archivo no contiene JSON válido.';
    }
    if (this.destroyed || request !== this.attachmentPreviewRequest) return;
    this.attachmentPreviewText.set(text);
    this.attachmentPreviewDialog()?.nativeElement.showModal();
  }

  closeAttachmentPreview(): void {
    this.attachmentPreviewRequest++;
    this.attachmentPreviewText.set('');
    this.attachmentPreviewDialog()?.nativeElement.close();
  }
  readonly savedSaleId = signal<number | null>(null);
  readonly emailRetrying = signal(false);

  onAttachmentsSelected(event: Event): void {
    if (this.isLoading() || this.savedSaleId() !== null) return;
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.selectAttachments(files);
  }

  onAttachmentsDropped(event: DragEvent): void {
    event.preventDefault();
    this.draggingAttachments.set(false);
    this.selectAttachments(Array.from(event.dataTransfer?.files ?? []));
  }

  private selectAttachments(files: File[]): void {
    if (this.isLoading() || this.savedSaleId() !== null || files.length === 0) return;
    const pdfs = files.filter((file) => /\.pdf$/i.test(file.name));
    const jsons = files.filter((file) => /\.json$/i.test(file.name));
    if (files.length > 2 || pdfs.length > 1 || jsons.length > 1 ||
      pdfs.length + jsons.length !== files.length) {
      this.alertService.showError('Selecciona como máximo un PDF y un JSON válidos.');
      return;
    }
    this.closeAttachmentPreview();
    this.attachmentFiles.update((current) => [
      ...current.filter((file) => /\.pdf$/i.test(file.name) ? pdfs.length === 0 : jsons.length === 0),
      ...files,
    ]);
  }

  removeAttachment(file: File): void {
    if (this.isLoading() || this.savedSaleId() !== null) return;
    this.closeAttachmentPreview();
    this.attachmentFiles.update((files) => files.filter((attachment) => attachment !== file));
  }

  private validateAttachments(): boolean {
    if (this.attachmentFiles().length === 0 || this.attachmentsComplete()) return true;
    this.alertService.showError('Adjunta un PDF y un JSON antes de guardar, o quita los documentos para continuar sin adjuntos.');
    return false;
  }

  retryEmail(): void {
    const id = this.savedSaleId();
    if (id === null || this.emailRetrying()) return;
    this.emailRetrying.set(true);
    this.saleOrderService.sendEmail(id).pipe(takeUntil(this.destroyed$)).subscribe({
      next: (response): void => {
        this.emailRetrying.set(false);
        this.cdr?.markForCheck();
        if (response.emailStatus !== 'sent') {
          this.alertService.showWarning(response.message || 'La venta está guardada, pero el correo no pudo enviarse. Intenta nuevamente o llama a soporte');
          return;
        }
        this.alertService.showSuccess('Correo enviado');
        void this.router.navigate(['/sale-orders/list']);
      },
      error: (): void => {
        this.emailRetrying.set(false);
        this.cdr?.markForCheck();
        this.alertService.showWarning('La venta está guardada, pero el correo no pudo enviarse. Intenta nuevamente o llama a soporte');
      },
    });
  }

  viewSavedSale(): void {
    void this.router.navigate(['/sale-orders/list']);
  }

  priceConfirmationMessage = signal('');
  private priceConfirmationResolver: ((confirmed: boolean) => void) | null =
    null;
  priceDialog = viewChild<ElementRef<HTMLDialogElement>>('priceConfirmDialog');
  invoiceConfirmModal = viewChild(ConfirmActionModalComponent);

  /** Resumen compacto mostrado antes de enviar la factura. */
  invoiceSummaryMessage = computed(
    () => {
      const customer =
        this.customerDetail()?.name ??
        this.selectedCustomer()?.name ??
        'Consumidor final';
      const itemCount = this.itemsArray.value.reduce(
        (total: number, item: CheckoutItemFormGroup['value']) =>
          total + Number(item.quantity || 0),
        0,
      );
      const documentType = this.isTaxCredit()
        ? 'Crédito fiscal'
        : 'Consumidor final';

      return [
        `Documento: ${documentType}`,
        `Cliente: ${customer}`,
        `Artículos: ${itemCount}`,
        `Total: $${Number(this.totalEstimate()).toFixed(2)}`,
        '',
        '¿Desea confirmar la venta?',
      ].join('\n');
    },
  );

  /** Enum expuesto al template para los chips. */
  checkoutDocType = CheckoutDocumentType;

  // ---- Tipo de documento (chips desde catálogo) ----
  documentTypeCatalogQuery = injectQuery(() => ({
    queryKey: ['catalog', 'document-type'],
    queryFn: () =>
      firstValueFrom(this.catalogService.getCatalog('document-type')),
    staleTime: 1000 * 60 * 30,
  }));

  documentType = signal<CheckoutDocumentType>(CheckoutDocumentType.INVOICE);
  documentTypeId = signal<number | null>(null);

  private catalogEntry = (code: string): CatalogItem | undefined =>
    this.documentTypeCatalogQuery.data()?.find((item) => item.code === code);

  invoiceEntry = computed(() => this.catalogEntry(DTE_CATALOG_CODES.INVOICE));
  taxCreditEntry = computed(() =>
    this.catalogEntry(DTE_CATALOG_CODES.TAX_CREDIT),
  );

  isTaxCredit = computed(
    () => this.documentType() === CheckoutDocumentType.TAX_CREDIT,
  );

  /**
   * Resuelve el documentTypeId solo cuando falta: al restaurar un borrador
   * (o form virgen) el id es null hasta que el catálogo carga. Sin esto,
   * el chip se ve bien pero internamente no hay id y el submit revienta.
   */
  resolveDocumentTypeEffect = effect(() => {
    const catalog = this.documentTypeCatalogQuery.data();
    if (!catalog?.length || this.documentTypeId() !== null) return;
    const code =
      this.documentType() === CheckoutDocumentType.INVOICE
        ? DTE_CATALOG_CODES.INVOICE
        : DTE_CATALOG_CODES.TAX_CREDIT;
    const entry = catalog.find((item) => item.code === code);
    if (entry) this.documentTypeId.set(entry.id);
  });

  setDocumentChip(type: CheckoutDocumentType) {
    const entry =
      type === CheckoutDocumentType.INVOICE
        ? this.invoiceEntry()
        : this.taxCreditEntry();
    if (!entry) {
      this.alertService.showError(
        'Tipo de documento no disponible en el catálogo',
      );
      return;
    }
    this.documentType.set(type);
    this.documentTypeId.set(entry.id);
    // Al pasar a crédito fiscal la selección previa puede no ser
    // contribuyente: se limpia para no dejar un estado inválido.
    if (type === CheckoutDocumentType.TAX_CREDIT) {
      this.clearCustomerSelection();
    }
    // Cliente requerido solo en crédito fiscal.
    const customerControl = this.checkoutForm.get('customerId');
    if (type === CheckoutDocumentType.TAX_CREDIT) {
      customerControl?.setValidators([Validators.required]);
    } else {
      customerControl?.clearValidators();
    }
    customerControl?.updateValueAndValidity();
    this.syncDraft();
  }

  reviewItems(): readonly ReviewItem[] {
    return [
      { label: 'Tipo de documento', complete: !!this.documentTypeId(), touched: this.checkoutForm.touched },
      { label: this.isTaxCredit() ? 'Cliente para crédito fiscal' : 'Cliente (opcional)', complete: !!this.checkoutForm.controls.customerId.value && (!this.isTaxCredit() || !!this.customerDetail()?.isTaxPayer), touched: this.customerTouched() || this.checkoutForm.touched, optional: !this.isTaxCredit() },
      { label: 'Productos y cantidades', complete: this.itemsArray.length > 0 && this.itemsArray.valid && this.itemsArray.value.every((item: CheckoutItemFormGroup['value']) => typeof item.zoneId === 'number' && Number.isSafeInteger(item.zoneId) && item.zoneId > 0), touched: this.itemsArray.dirty || this.itemsArray.touched },
      { label: 'Pagos', complete: this.paymentsArray.length > 0 && this.paymentsArray.valid && this.paymentsTotal() >= this.totalEstimate() && this.nonCashTotal() <= this.totalEstimate(), touched: this.paymentsArray.dirty || this.paymentsArray.touched },
      { label: 'Documentos originales (opcionales)', complete: this.attachmentsComplete(), touched: false, optional: true },
    ].sort((first, second) => Number(!!first.optional) - Number(!!second.optional));
  }
  // ---- Form principal ----
  checkoutForm = this.fb.group({
    customerId: [null as number | null],
    items: this.fb.array<CheckoutItemFormGroup>([], {
      validators: Validators.minLength(1),
    }),
    discountType: [null as DiscountType | null],
    discountValue: [null as number | null],
    payments: this.fb.array<CheckoutPaymentFormGroup>([], {
      validators: Validators.minLength(1),
    }),
    paymentTermId: [null as number | null],
  });

  get itemsArray() {
    return this.checkoutForm.get('items') as FormArray;
  }

  get paymentsArray() {
    return this.checkoutForm.get('payments') as FormArray;
  }

  // ---- Cliente (combobox) ----
  selectedCustomer = signal<ValueParams | null>(null);
  customerComboboxOutput = signal('');
  /** Perezoso: pide al interactuar con su combobox. */
  customerTouched = signal(false);

  customersQuery = injectQuery(() => ({

    enabled: this.customerTouched(),
    queryKey: [
      'customer-combobox',
      this.customerComboboxOutput(),
      this.documentType(),
    ],
    queryFn: () =>
      firstValueFrom(
        this.customerService.getCustomers(
          1,
          5,
          this.customerComboboxOutput(),
        ),
      ).then((response) =>
        response.data
          // Crédito fiscal: solo contribuyentes. Consumidor final: cualquiera.
          .filter((customer) => !this.isTaxCredit() || customer.isTaxPayer)
          .map(
            (customer): ValueParams => ({
              id: customer.id,
              name: customer.name,
            }),
          ),
      ),
    staleTime: 1000 * 60 * 5,
  }));

  setCustomer(customer: ValueParams | null) {
    this.checkoutForm.get('customerId')?.setValue(customer?.id ?? null);
    this.checkoutForm.get('customerId')?.markAsDirty();
    this.selectedCustomer.set(customer);
    this.syncDraft();
  }

  /**
   * Desliga el cliente por completo: el control, la selección del combobox y
   * el cliente creado en línea. Sin esto el modo Nuevo conserva la fila del
   * cliente (y el borrador su nombre) aunque ya no sea válido para el tipo de
   * documento elegido.
   */
  private clearCustomerSelection() {
    this.setCustomer(null);
    this.newCustomer.set(null);
    this.draftService.draft.update((draft) => ({
      ...draft,
      customerName: null,
    }));
    this.draftService.persist();
  }

  // ---- Ficha del cliente: accordion (daisyUI) ----
  /**
   * Corte de viewport: desde acá hay ancho para dejar la ficha extendida.
   * `matchMedia` solo existe en navegador, así que se resuelve perezoso (y sin
   * caché) en vez de en un inicializador de campo: en SSR/prerender no hay
   * `window` y esto se construía igual. Mismo guard que `theme.service` y
   * `dashboard-layout`; sin ventana devuelve `null` y el accordion arranca con
   * el default de escritorio.
   */
  private clientInfoMedia(): MediaQueryList | null {
    return typeof window === 'undefined'
      ? null
      : window.matchMedia?.('(min-width: 768px)') ?? null;
  }

  /**
   * Estado real del `<details>` de la ficha. Arranca según el viewport
   * (escritorio abierto, teléfono contraído) y después manda el usuario: el
   * `toggle` del template escribe acá el `open` real del elemento.
   */
  readonly clientInfoOpen = signal(this.clientInfoMedia()?.matches ?? true);

  /**
   * Rotar el teléfono o redimensionar la ventana reacomoda la ficha al ancho
   * disponible. El cleanup corre al destruir el componente (o al reejecutarse
   * el efecto), así el listener nunca queda colgando.
   */
  private readonly clientInfoViewportEffect = effect((onCleanup) => {
    const media = this.clientInfoMedia();
    if (!media) return;
    const sync = () => this.clientInfoOpen.set(media.matches);
    media.addEventListener('change', sync);
    onCleanup(() => media.removeEventListener('change', sync));
  });

  // ---- Cliente: modo Existente / Nuevo ----
  /** El combobox solo aplica al modo Existente; en Nuevo el cliente se crea. */
  customerMode = signal<CheckoutCustomerMode>('EXISTING');
  isNewCustomerMode = computed(() => this.customerMode() === 'NEW');

  /** Cliente creado/editar en línea (modo Nuevo). */
  newCustomer = signal<Customer | null>(null);
  customerFormModal = viewChild(CustomerFormModalComponent);
  /** Warning de cliente migrado incompleto (misma regla que customer-table). */
  readonly missingFields = customerMissingFields;

  /**
   * Cliente completo del seleccionado: el combobox solo trae id+nombre, así
   * que la fila resumen y el warning necesitan el detalle. La clave
   * ['customer', id] cachea el dato: volver a elegir el mismo cliente no
   * vuelve a pedirlo.
   */
  selectedCustomerQuery = injectQuery(() => {
    const id = this.selectedCustomer()?.id ?? null;
    return {
      queryKey: ['customer', id],
      queryFn: () => {
        // Solo corre con `enabled: id != null`; el guard estrecha el tipo.
        if (id === null) throw new Error('No hay cliente seleccionado');
        return firstValueFrom(this.customerService.getCustomerById(id));
      },
      enabled: id != null,
      staleTime: 1000 * 60 * 5,
    };
  });

  /** Fila de la tabla resumen: en Nuevo es el recién creado, no se consulta. */
  customerDetail = computed<Customer | null>(() => {
    if (!this.selectedCustomer()) return null;
    if (this.isNewCustomerMode()) return this.newCustomer();
    return this.selectedCustomerQuery.data() ?? null;
  });

  isLoadingCustomerDetail = computed(
    () =>
      !!this.selectedCustomer() &&
      this.selectedCustomerQuery.isFetching() &&
      !this.customerDetail(),
  );

  /**
   * Cambiar de modo limpia la selección del otro: en Nuevo no hay combobox
   * (el cliente se crea), y la fila creada se descarta al volver a Existente.
   */
  setCustomerMode(mode: CheckoutCustomerMode) {
    if (this.customerMode() === mode) return;
    this.customerMode.set(mode);
    if (mode === 'NEW') {
      this.setCustomer(null);
    } else {
      this.newCustomer.set(null);
    }
  }

  onCreateNewCustomer(): void {
    this.customerFormModal()?.openForCreate(this.isTaxCredit());
  }

  /** Crea otro cliente: se vuelve al formulario vacío. */
  onCreateAnotherCustomer(): void {
    this.newCustomer.set(null);
    this.setCustomer(null);
    this.customerFormModal()?.openForCreate(this.isTaxCredit());
  }

  onModifyNewCustomer(): void {
    const customer = this.newCustomer();
    if (!customer) return;
    this.customerFormModal()?.openForEdit(customer, this.isTaxCredit());
  }

  /**
   * Espejo de `onModifyNewCustomer` para el modo Existente: edita el cliente
   * que ya está elegido. `customerDetail()` devuelve el detalle cacheado en
   * ['customer', id], así que el modal abre con todos sus datos.
   */
  onModifyExistingCustomer() {
    const customer = this.customerDetail();
    if (!customer) return;
    this.customerFormModal()?.openForEdit(customer);
  }

  /**
   * El modal ya se encarga del POST/PATCH y de invalidar ['customers']; acá
   * solo se siembra lo retornado en ['customer', id] (para no refetchear) y
   * el cliente queda seleccionado en la orden.
   */
  onCustomerSaved(customer: Customer) {
    // Crédito fiscal solo admite contribuyentes: mismo filtro que el combobox
    // EXISTENTE. El cliente ya se guardó, pero no se liga a la venta.
    if (this.isTaxCredit() && !customer.isTaxPayer) {
      this.alertService.showError(
        'El cliente no es contribuyente, el crédito fiscal solo admite contribuyentes',
      );
      return;
    }
    // Sembrar ['customer', id] refresca la ficha también en modo Existente
    // (ahí la fila se dibuja desde la query, no desde `newCustomer`).
    this.queryClient.setQueryData(['customer', customer.id], customer);
    if (this.isNewCustomerMode()) {
      this.newCustomer.set(customer);
    }
    this.setCustomer({ id: customer.id, name: customer.name });
  }

  /** El botón eliminar abre el dialog por onclick (id my_modal_1). */
  deleteCustomerEffect = effect(() => {
    if (this.deleteModalService.state() === 'confirming') {
      this.onDeleteCustomerConfirmed();
    }
  });

  private onDeleteCustomerConfirmed() {
    this.deleteModalService.state.set('loading');
    const customer = this.newCustomer();
    if (!customer) {
      this.deleteModalService.state.set('finished');
      return;
    }
    this.mutationDeleteCustomer.mutate(customer);
  }

  mutationDeleteCustomer = injectMutation(() => ({
    mutationFn: (customer: Customer) =>
      firstValueFrom(this.customerService.deleteCustomer(customer.id)),
    onSuccess: (_deleted, customer) => {
      this.deleteModalService.state.set('finished');
      // El detalle eliminado no debe quedar cacheado para otra pantalla.
      this.queryClient.removeQueries({ queryKey: ['customer', customer.id] });
      this.queryClient.invalidateQueries({ queryKey: ['customers'] });
      invalidateCatalogCaches(this.queryClient);
      this.newCustomer.set(null);
      this.setCustomer(null);
      this.alertService.showSuccess('Cliente eliminado con éxito');
    },
    onError: (exception) => {
      this.deleteModalService.state.set('finished');
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  // ---- Items (modal, espejo de purchase-orders) ----
  itemForm = this.fb.group({
    productId: [0, [Validators.required, Validators.min(1)]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    zoneId: [null as number | null, [Validators.required]],
    unitPrice: [null as number | null, [Validators.min(0)]],
    discountType: [null as DiscountType | null],
    discountValue: [null as number | null],
  });

  selectedProduct = signal<ValueParams | null>(null);
  selectedZone = signal<ValueParams | null>(null);
  selectedIndexItem = signal<number | null>(null);
  /** Precio estimado (UI): el servidor resuelve el real al facturar. */
  priceEstimate = signal('0');
  /** Stock del producto seleccionado: total + por zona ("Bodega / Zona"). */
  productStock = signal<{
    total: number;
    zones: { label: string; quantity: number }[];
  } | null>(null);
  private priceCache = new Map<
    number,
    {
      price: string;
      stock: { total: number; zones: { label: string; quantity: number }[] };
      productType: PRODUCT_TYPE;
    }
  >();

  productComboboxOutput = signal('');
  /** Perezoso: pide al interactuar con su combobox. */
  productTouched = signal(false);
  productsQuery = injectQuery(() => ({

    enabled: this.productTouched(),
    queryKey: [
      'product-combobox',
      this.productComboboxOutput(),
      this.productTypeFilter(),
    ],
    queryFn: () =>
      firstValueFrom(
        this.productService.getSummaryByName(
          this.productComboboxOutput(),
          // Los servicios son intangibles: sin filtro de stock.
          this.productTypeFilter() === 'SERVICE'
            ? undefined
            : 'IN_STOCK',
          this.productTypeFilter() || undefined,
        ),
      ),
    staleTime: 1000 * 60 * 5,
  }));

  /** Chips del modal: Todos | Llantas | Suministros | Servicios. */
  productTypeFilter = signal<'' | 'TIRE' | 'SUPPLY' | 'SERVICE'>('');

  /** Cascada del modal: sin producto no valen bodega, zona, precio ni stock. */
  private clearCascadeBelowProduct() {
    this.selectedWarehouse.set(null);
    this.clearZoneSelection();
    this.selectedProductType.set(null);
    this.productStock.set(null);
    this.priceEstimate.set('0');
  }

  setProductTypeFilter(value: '' | 'TIRE' | 'SUPPLY' | 'SERVICE') {
    if (this.productTypeFilter() === value) return;
    this.productTypeFilter.set(value);
    // Cambia el tipo: la cascada elegida antes ya no corresponde.
    this.itemForm.get('productId')?.setValue(0);
    this.selectedProduct.set(null);
    this.clearCascadeBelowProduct();
  }

  zoneComboboxOutput = signal('');
  /** Perezoso: pide al interactuar con su combobox. */
  zoneTouched = signal(false);
  selectedWarehouse = signal<ValueParams | null>(null);
  warehouseComboboxOutput = signal('');
  /** Perezoso: pide al interactuar con su combobox. */
  warehouseTouched = signal(false);

  warehousesQuery = injectQuery(() => ({
    // Sin producto no hay bodegas que filtrar: no se consulta.
    enabled: this.warehouseTouched() && !!this.selectedProduct(),
    queryKey: [
      'warehouse-combobox',
      this.warehouseComboboxOutput(),
      this.selectedProduct()?.id ?? null,
    ],
    queryFn: () =>
      firstValueFrom(
        this.warehouseService.searchWarehousesByName(
          5,
          this.warehouseComboboxOutput(),
          this.selectedProduct()?.id ?? undefined,
        ),
      ),
    staleTime: 1000 * 60 * 5,
  }));

  zonesQuery = injectQuery(() => ({
    // Sin producto no hay zonas que ofrecer: no se consulta.
    enabled: this.zoneTouched() && !!this.selectedProduct(),
    queryKey: [
      'zone-combobox',
      this.zoneComboboxOutput(),
      'IN_STOCK',
      this.selectedWarehouse()?.id ?? null,
      this.selectedProduct()?.id ?? null,
    ],
    queryFn: () =>
      firstValueFrom(
        this.zoneService.getZonesByName(
          5,
          this.zoneComboboxOutput(),
          'IN_STOCK',
          this.selectedWarehouse()?.id ?? undefined,
          this.selectedProduct()?.id ?? undefined,
        ),
      ),
    staleTime: 1000 * 60 * 5,
  }));

  /** Cascada: se limpia la zona elegida y su control. */
  private clearZoneSelection() {
    this.selectedZone.set(null);
    this.itemForm.get('zoneId')?.setValue(null);
  }

  setWarehouse(warehouse: ValueParams | null) {
    this.selectedWarehouse.set(warehouse);
    // Cascada: cambia la bodega, se limpia la zona.
    this.clearZoneSelection();
  }

  itemDialog = viewChild<ElementRef<HTMLDialogElement>>('itemModal');

  closeItemModal() {
    this.itemDialog()?.nativeElement.close();
  }

  setItemProduct(product: ValueParams | null) {
    const changed = product?.id !== this.selectedProduct()?.id;
    this.itemForm.get('productId')?.setValue(product?.id ?? 0);
    this.itemForm.get('productId')?.markAsDirty();
    this.selectedProduct.set(product);
    if (product) {
      // Cascada: cambió el producto, bodega y zona se limpian.
      if (changed) {
        this.clearCascadeBelowProduct();
      }
      this.resolvePrice(product.id);
    } else {
      // Sin producto no hay precio ni zona que valga.
      this.clearCascadeBelowProduct();
    }
  }

  setItemZone(zone: ValueParams | null) {
    this.itemForm.get('zoneId')?.setValue(zone?.id ?? null);
    this.itemForm.get('zoneId')?.markAsDirty();
    this.selectedZone.set(zone);
  }

  /** Tipo del producto elegido (los servicios no mueven stock). */
  selectedProductType = signal<PRODUCT_TYPE | null>(null);
  isServiceItem = computed(
    () => this.selectedProductType() === PRODUCT_TYPE.SERVICE,
  );

  /** El resumen solo trae id+nombre: se prueba TIRE, SUPPLY y SERVICE. */
  private resolvePrice(productId: number): void {
    const cached = this.priceCache.get(productId);
    this.productStock.set(null);
    if (cached !== undefined) {
      this.priceEstimate.set(cached.price);
      this.productStock.set(cached.stock);
      this.selectedProductType.set(cached.productType);
      return;
    }
    this.priceEstimate.set('0');
    this.selectedProductType.set(null);
    firstValueFrom(
      this.productService.getProductById(productId, PRODUCT_TYPE.TIRE).pipe(
        catchError(() =>
          this.productService.getProductById(productId, PRODUCT_TYPE.SUPPLY),
        ),
        catchError(() =>
          this.productService.getProductById(productId, PRODUCT_TYPE.SERVICE),
        ),
      ),
    )
      .then((product) => {
        const price = product.salePrice ?? '0';
        const stock = {
          total: product.stock ?? 0,
          zones: (product.ProductZoneStock ?? []).map((entry) => ({
            label: `${entry.zone.warehouse.name} / ${entry.zone.name}`,
            quantity: entry.quantity,
          })),
        };
        this.priceCache.set(productId, {
          price,
          stock,
          productType: product.type as PRODUCT_TYPE,
        });
        if (this.selectedProduct()?.id !== productId) return;
        this.priceEstimate.set(price);
        this.productStock.set(stock);
        this.selectedProductType.set(product.type as PRODUCT_TYPE);
        this.cdr?.markForCheck();
      })
      .catch(() => {
        if (this.selectedProduct()?.id === productId) this.priceEstimate.set('0');
        this.cdr?.markForCheck();
      });
  }

  /** Disponible en la zona elegida (null = sin datos, no se valida). */
  zoneAvailable = computed(() => {
    const zone = this.selectedZone();
    const stock = this.productStock();
    if (!zone || !stock) return null;
    return stock.zones.find((entry) => entry.label === zone.name)?.quantity ?? 0;
  });

  private lineTotalFor(
    quantity: number,
    unitPrice: string,
    discountType: DiscountType | null,
    discountValue: number | null,
  ): string {
    let line = new Decimal(quantity || 0).times(new Decimal(unitPrice || 0));
    if (discountType && discountValue != null) {
      line =
        discountType === DiscountType.PERCENT
          ? line.minus(line.times(new Decimal(discountValue).div(100)))
          : line.minus(new Decimal(discountValue));
    }
    return Decimal.max(line, 0).toString();
  }

  needsItemWarehouse(): boolean {
    return this.itemForm.controls.productId.valid && this.itemForm.controls.zoneId.invalid &&
      !this.selectedWarehouse() && this.selectedIndexItem() === null;
  }

  itemValidationMessages(): string[] {
    const controls = this.itemForm.controls;
    const messages: string[] = [];
    if (controls.productId.invalid) messages.push('Selecciona un producto.');
    if (controls.productId.valid && controls.zoneId.invalid) {
      messages.push(this.needsItemWarehouse()
        ? 'Selecciona una bodega y después la zona de salida del producto.'
        : 'Selecciona la zona de salida del producto.');
    }
    if (controls.quantity.invalid) messages.push('Indica una cantidad mayor o igual a 1.');
    if (controls.unitPrice.invalid) messages.push('El precio de venta no puede ser negativo.');
    return messages;
  }

  onSaveItem(): void {
    this.itemForm.markAllAsTouched();
    this.itemForm.markAsDirty();
    const messages = this.itemValidationMessages();
    if (messages.length > 0) {
      this.alertService.showError(messages.join(' '));
      return;
    }
    if (!this.itemForm.valid) {
      this.alertService.showError('Revisa los datos del producto antes de guardarlo.');
      return;
    }

    const {
      productId,
      quantity,
      zoneId,
      unitPrice,
      discountType,
      discountValue,
    } = this.itemForm.value;
    // Form válido: los required garantizan estos valores; el guard estrecha el tipo.
    if (productId == null || quantity == null || zoneId == null) return;
    // Descuento en 0 = no escrito: se normaliza a ausencia.
    const normDiscountValue =
      discountValue != null && discountValue !== 0 ? discountValue : null;
    const normDiscountType = normDiscountValue != null ? discountType : null;
    if (
      (discountType && normDiscountValue == null && discountValue == null) ||
      (!discountType && normDiscountValue != null)
    ) {
      this.alertService.showError(
        'El descuento lleva tipo y valor juntos, o ninguno',
      );
      return;
    }
    const duplicate = this.itemsArray.controls.some((item, controlIndex) => {
      if (controlIndex === this.selectedIndexItem()) return false;
      return (
        item.get('productId')?.value === productId &&
        item.get('zoneId')?.value === zoneId
      );
    });
    if (duplicate) {
      this.alertService.showError(
        'El producto ya existe en la tabla con la misma zona',
      );
      return;
    }
    const available = this.zoneAvailable();
    // Los servicios no tienen stock: no se valida disponibilidad.
    if (!this.isServiceItem() && available !== null && quantity > available) {
      this.alertService.showError(
        `Solo hay ${available} unidades disponibles en esta zona`,
      );
      return;
    }

    const effectiveUnitPrice = unitPrice?.toString() ?? this.priceEstimate();
    const group = this.fb.group({
      productId: [productId],
      name: [this.selectedProduct()?.name ?? ''],
      quantity: [quantity],
      zoneId: [zoneId],
      zoneName: [this.selectedZone()?.name ?? ''],
      unitPrice: [unitPrice ?? null],
      unitPriceEstimate: [this.priceEstimate()],
      lineTotal: [
        this.lineTotalFor(
          quantity,
          effectiveUnitPrice,
          normDiscountType ?? null,
          normDiscountValue,
        ),
      ],
      discountType: [normDiscountType ?? null],
      discountValue: [normDiscountValue],
    });

    const index = this.selectedIndexItem();
    if (index === null) {
      this.itemsArray.push(group);
    } else {
      this.itemsArray.setControl(index, group);
    }
    this.checkoutForm.markAsDirty();
    this.resetItemForm();
    this.selectedIndexItem.set(null);
    this.itemDialog()?.nativeElement.close();
    this.syncDraft();
  }

  resetItemForm(): void {
    this.itemForm.reset({ productId: 0, quantity: 1 });
    this.selectedProduct.set(null);
    this.selectedZone.set(null);
    this.selectedWarehouse.set(null);
    this.selectedProductType.set(null);
    this.priceEstimate.set('0');
    this.productStock.set(null);
  }

  onCreateItem() {
    this.resetItemForm();
    this.selectedIndexItem.set(null);
    this.itemDialog()?.nativeElement.showModal();
  }

  onModifyItem(): void {
    const index = this.selectedIndexItem();
    if (index === null) return;
    const detail = this.itemsArray.at(index);
    const productId = detail.value.productId;
    if (typeof productId !== 'number') return;
    this.resetItemForm();
    this.itemForm.patchValue({
      productId: detail.value?.productId,
      quantity: detail.value?.quantity,
      zoneId: detail.value?.zoneId,
      unitPrice: detail.value?.unitPrice,
      discountType: detail.value?.discountType,
      discountValue: detail.value?.discountValue,
    });
    this.selectedProduct.set({
      id: productId,
      name: detail.value.name ?? '',
    });
    const zoneId = detail.value.zoneId;
    this.selectedZone.set(typeof zoneId === 'number' && zoneId > 0 ? { id: zoneId, name: detail.value.zoneName ?? '' } : null);
    this.resolvePrice(productId);
    this.itemDialog()?.nativeElement.showModal();
  }

  onDeleteItem(index: number) {
    this.selectedIndexItem.set(null);
    this.itemsArray.removeAt(index);
    this.checkoutForm.markAsDirty();
    this.syncDraft();
  }

  onChangeIdItem(id: number | null) {
    this.selectedIndexItem.update((current) => (current === id ? null : id));
  }

  // ---- Totales estimados ----
  itemsSnapshot = signal<CheckoutItemFormGroup['value'][]>([]);

  subtotalEstimate = computed(() =>
    this.itemsSnapshot().reduce(
      (acc, item) =>
        new Decimal(acc)
          .plus(new Decimal(item.lineTotal || 0))
          .toString(),
      '0',
    ),
  );

  totalEstimate = computed(() => {
    const { discountType, discountValue } = this.checkoutForm.value;
    let total = new Decimal(this.subtotalEstimate());
    if (discountType && discountValue != null) {
      total =
        discountType === DiscountType.PERCENT
          ? total.minus(total.times(new Decimal(discountValue).div(100)))
          : total.minus(new Decimal(discountValue));
    }
    return Decimal.max(total, 0).toString();
  });

  // ---- Pagos ----
  paymentMethodsQuery = injectQuery(() => ({
    queryKey: ['catalog', 'payment-methode'],
    queryFn: () =>
      firstValueFrom(this.catalogService.getCatalog('payment-methode')),
    staleTime: 1000 * 60 * 30,
  }));

  paymentTermsQuery = injectQuery(() => ({
    queryKey: ['catalog', 'payment-term'],
    queryFn: () =>
      firstValueFrom(this.catalogService.getCatalog('payment-term')),
    staleTime: 1000 * 60 * 30,
  }));

  paymentsSnapshot = signal<CheckoutPaymentFormGroup['value'][]>([]);

  paymentsTotal = computed(() =>
    this.paymentsSnapshot().reduce(
      (acc, payment) =>
        new Decimal(acc).plus(new Decimal(payment.amount || 0)).toString(),
      '0',
    ),
  );

  /** Código Hacienda del método (CAT-016): '01' = efectivo/monedas. */
  private paymentCodeOf(paymentMethodId: number | null | undefined): string {
    return (
      (this.paymentMethodsQuery.data() ?? []).find(
        (method) => method.id === paymentMethodId,
      )?.code ?? ''
    );
  }

  /** Suma pagada en efectivo (único medio que admite excedente). */
  cashTotal = computed(() =>
    this.paymentsSnapshot().reduce(
      (acc, payment) =>
        this.paymentCodeOf(payment.paymentMethodId) === '01'
          ? new Decimal(acc).plus(new Decimal(payment.amount || 0)).toString()
          : acc,
      '0',
    ),
  );

  /** Suma pagada por otros medios (deben ser exactos, sin excedente). */
  nonCashTotal = computed(() =>
    new Decimal(this.paymentsTotal()).minus(new Decimal(this.cashTotal())).toString(),
  );

  /** Cambio a retornar (solo front: el back recorta, acá solo se muestra). */
  changeTotal = computed(() => {
    const change = new Decimal(this.paymentsTotal()).minus(
      new Decimal(this.totalEstimate()),
    );
    return change.greaterThan(0) ? change.toString() : '0';
  });

  /** Hay al menos un pago en efectivo con monto: sin método no hay cambio. */
  hasCashPayment = computed(() =>
    this.paymentsSnapshot().some(
      (payment) =>
        this.paymentCodeOf(payment.paymentMethodId) === '01' &&
        new Decimal(payment.amount || 0).greaterThan(0),
    ),
  );

  /** El cambio solo se muestra con cantidad Y método en efectivo. */
  showChange = computed(
    () => this.changeTotal() !== '0' && this.hasCashPayment(),
  );

  /** Id del método efectivo (CAT-016 '01'): primera opción por defecto. */
  private cashMethodId(): number | null {
    return (
      (this.paymentMethodsQuery.data() ?? []).find(
        (method) => method.code === '01',
      )?.id ?? null
    );
  }

  onAddPayment() {
    // El primero cubre el total exacto; los siguientes empiezan en 0.
    const isFirst = this.paymentsArray.length === 0;
    this.paymentsArray.push(
      this.fb.group({
        paymentMethodId: [
          isFirst ? this.cashMethodId() : null,
          [Validators.required],
        ],
        amount: [
          isFirst ? Number(this.totalEstimate()) || 0 : 0,
          [Validators.required, Validators.min(0.01)],
        ],
      }),
    );
    this.checkoutForm.markAsDirty();
    this.syncDraft();
  }

  onDeletePayment(index: number): void {
    this.paymentsArray.removeAt(index);
    const firstPayment = this.checkoutForm.controls.payments.at(0);
    if (firstPayment && firstPayment.controls.paymentMethodId.value == null) {
      firstPayment.controls.paymentMethodId.setValue(this.cashMethodId());
    }
    this.checkoutForm.markAsDirty();
    this.syncDraft();
  }

  // ---- Submit ----
  mutationCheckout = injectMutation(() => ({
    mutationFn: (payload: CheckoutPayload) =>
      firstValueFrom(this.saleOrderService.checkout(payload, this.attachmentFiles())),
    onSuccess: (response) => {
      this.queryClient.invalidateQueries({ queryKey: ['sale-orders'] });
      this.isLoading.set(false);
      this.savedSaleId.set(response.saleOrderId);
      this.formChangesSubscription?.unsubscribe();
      this.checkoutForm.disable({ emitEvent: false });
      this.draftService.reset();
      this.attachmentFiles.set([]);
      this.cdr?.markForCheck();
      if (response.emailStatus === 'failed') {
        this.alertService.showWarning('Se generó la venta, pero el email no pudo ser enviado. Intenta nuevamente o llama a soporte');
        return;
      }
      this.alertService.showSuccess(response.message || 'Venta creada con éxito');
      void this.router.navigate(['/sale-orders/list']);
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.cdr?.markForCheck();
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  async onSubmit(): Promise<void> {
    if (this.isLoading() || this.savedSaleId() !== null) return;
    if (!this.validateAttachments()) return;
    this.checkoutForm.markAllAsTouched();
    if (this.itemsArray.value.some((item: CheckoutItemFormGroup['value']) => typeof item.zoneId !== 'number' || !Number.isSafeInteger(item.zoneId) || item.zoneId < 1)) {
      this.alertService.showError('Selecciona una zona para cada producto antes de confirmar la venta');
      return;
    }
    if (this.itemsArray.invalid) {
      this.alertService.showError('Revisa los productos y sus cantidades antes de confirmar la venta.');
      return;
    }

    if (this.itemsArray.length === 0) {
      this.alertService.showError('Debe agregar al menos un producto');
      return;
    }
    if (this.paymentsArray.length === 0) {
      this.alertService.showError('Debe agregar al menos un pago');
      return;
    }
    if (this.paymentsArray.invalid) {
      this.alertService.showError('Revisa los pagos: cada uno debe tener un método de pago y un monto mayor que cero.');
      return;
    }
    const customerId = this.checkoutForm.value.customerId;
    if (this.isTaxCredit() && customerId == null) {
      this.alertService.showError(
        'El crédito fiscal requiere un cliente',
      );
      return;
    }
    if (!this.checkoutForm.valid) {
      this.alertService.showError('Revisa los datos obligatorios de la venta antes de continuar.');
      return;
    }
    if (!this.checkoutForm.dirty || !this.validatePayments()) return;
    // El borrador pudo guardar un no-contribuyente (o la data cambió):
    // se verifica contra el servidor antes de facturar.
    if (this.isTaxCredit() && customerId != null) {
      this.isLoading.set(true);
      firstValueFrom(
        this.customerService.getCustomerById(customerId),
      )
        .then((customer) => {
          this.cdr?.markForCheck();
          if (!customer.isTaxPayer) {
            this.isLoading.set(false);
            this.clearCustomerSelection();
            this.alertService.showError(
              'El cliente seleccionado no es contribuyente',
            );
            return;
          }
          this.confirmMissingPricesAndSend();
        })
        .catch(() => {
          this.isLoading.set(false);
          this.cdr?.markForCheck();
          this.alertService.showError(
            'No se pudo verificar al cliente',
          );
        });
      return;
    }
    this.confirmMissingPricesAndSend();
  }

  private validatePayments() {
    const total = new Decimal(this.totalEstimate());
    const paid = new Decimal(this.paymentsTotal());
    const nonCash = new Decimal(this.nonCashTotal());
    if (paid.lessThan(total)) {
      this.alertService.showError('Los pagos no cubren el total estimado');
      return false;
    }
    if (nonCash.greaterThan(total)) {
      this.alertService.showError(
        'Los pagos con tarjeta, transferencia u otros medios deben ser exactos: el excedente solo se permite en efectivo',
      );
      return false;
    }
    return true;
  }

  private async confirmMissingPricesAndSend() {
    const missingPrices = this.itemsArray.value.filter(
      (item: CheckoutItemFormGroup['value']) => item.unitPrice == null,
    );
    for (const item of missingPrices) {
      const confirmed = await this.confirmSuggestedPrice(
        item.unitPriceEstimate ?? '0',
      );
      if (!confirmed) return;
    }
    // Puerta de confirmación: el resumen (cliente + total) se acepta o se
    // cancela sin emitir nada; el payload no cambia.
    this.invoiceConfirmModal()?.open();
  }

  onInvoiceConfirmed() {
    this.sendCheckout();
  }

  private confirmSuggestedPrice(suggestedPrice: string) {
    this.priceConfirmationMessage.set(
      `No fue asignado un precio de venta, se empleara el precio de venta sugerido del producto ${suggestedPrice} esta de acuerdo?`,
    );
    this.priceDialog()?.nativeElement.showModal();
    return new Promise<boolean>((resolve) => {
      this.priceConfirmationResolver = resolve;
    });
  }

  confirmPrice() {
    this.resolvePriceConfirmation(true);
  }

  cancelPriceConfirmation() {
    this.resolvePriceConfirmation(false);
  }

  private resolvePriceConfirmation(confirmed: boolean) {
    const resolve = this.priceConfirmationResolver;
    this.priceConfirmationResolver = null;
    this.priceDialog()?.nativeElement.close();
    resolve?.(confirmed);
  }

  private sendCheckout(): void {
    if (this.savedSaleId() !== null) return;
    if (!this.validateAttachments()) return;
    const documentTypeId = this.documentTypeId();
    if (!documentTypeId) {
      this.alertService.showError(
        'Tipo de documento no resuelto del catálogo',
      );
      return;
    }

    const methodsById = new Map(
      (this.paymentMethodsQuery.data() ?? []).map((method) => [
        method.id,
        method,
      ]),
    );
    const paymentMethod = this.paymentsArray.value.map(
      (payment: CheckoutDraftPayment) => {
      // Formulario validado antes de enviar: un pago sin método/monto es un estado imposible.
      if (payment.paymentMethodId == null) {
        throw new Error('Pago sin método de pago asignado');
      }
      const method = methodsById.get(payment.paymentMethodId);
      return {
        amount: payment.amount,
        paymentMethodId: payment.paymentMethodId,
        code: method?.code ?? '',
        name: method?.name ?? '',
      };
    });

    const { discountType, discountValue, paymentTermId, customerId } =
      this.checkoutForm.value;
    const payload: CheckoutPayload = {
      ...(this.draftService.draft().quotationId != null ? { quotationId: this.draftService.draft().quotationId ?? undefined } : {}),
      requestId: this.draftService.draft().requestId,
      documentType: this.documentType(),
      documentTypeId,
      items: this.itemsArray.value.map((item: CheckoutDraftItem) => ({
        productId: item.productId!,
        productName: item.name!,
        quantity: item.quantity!,
        zoneId: item.zoneId!,
        ...(item.unitPrice != null ? { unitPrice: item.unitPrice } : {}),
        ...(item.discountType && item.discountValue != null && item.discountValue !== 0
          ? {
              discountType: item.discountType,
              discountValue: item.discountValue,
            }
          : {}),
      })),
      paymentMethod,
      // The key is omitted when there is no customer, so the DTO never
      // receives `null` (the customer is optional in INVOICE).
      ...(customerId != null ? { customerId } : {}),
      ...(discountType && discountValue != null && discountValue !== 0
        ? { discountType, discountValue }
        : {}),
      ...(paymentTermId ? { paymentTermId } : {}),
    };

    this.isLoading.set(true);
    this.mutationCheckout.mutate(payload);
  }

  requestClearDraft(): void {
    if (!this.isLoading() && this.savedSaleId() === null) this.clearDraftDialog()?.nativeElement.showModal();
  }

  clearDraft(): void {
    if (this.isLoading() || this.savedSaleId() !== null) return;
    this.clearDraftDialog()?.nativeElement.close();
    this.itemsArray.clear({ emitEvent: false });
    this.paymentsArray.clear({ emitEvent: false });
    this.checkoutForm.reset({ customerId: null, discountType: null, discountValue: null, paymentTermId: null }, { emitEvent: false });
    this.draftService.reset();
    this.documentType.set(CheckoutDocumentType.INVOICE);
    this.documentTypeId.set(this.invoiceEntry()?.id ?? null);
    this.checkoutForm.controls.customerId.clearValidators();
    this.checkoutForm.controls.customerId.updateValueAndValidity({ emitEvent: false });
    this.selectedCustomer.set(null);
    this.newCustomer.set(null);
    this.customerMode.set('EXISTING');
    this.customerComboboxOutput.set('');
    this.customerTouched.set(false);
    this.selectedIndexItem.set(null);
    this.resetItemForm();
    this.attachmentFiles.set([]);
    this.closeAttachmentPreview();
    this.pdfViewer()?.close();
    this.itemsSnapshot.set([]);
    this.paymentsSnapshot.set([]);
    this.quotationBannerDismissed.set(false);
    this.checkoutForm.markAsPristine();
    this.checkoutForm.markAsUntouched();
    this.cdr?.markForCheck();
  }

  onCancel() {
    this.draftService.reset();
    this.location.back();
  }

  backToPreviousPage() {
    this.location.back();
  }

  // ---- Borrador persistido ----
  private syncDraft(): void {
    if (this.savedSaleId() !== null) return;
    const { customerId, discountType, discountValue, paymentTermId } =
      this.checkoutForm.value;
    this.draftService.draft.update((draft) => ({
      ...draft,
      documentType: this.documentType(),
      documentTypeId: this.documentTypeId(),
      customerId: customerId ?? null,
      customerName: this.selectedCustomer()?.name ?? draft.customerName,
      items: this.itemsArray.value.map((item: CheckoutDraftItem) => ({
        productId: item.productId!,
        name: item.name!,
        quantity: item.quantity!,
        zoneId: item.zoneId!,
         zoneName: item.zoneName!,
         unitPrice: item.unitPrice ?? null,
         unitPriceEstimate: item.unitPriceEstimate!,
        lineTotal: item.lineTotal!,
        discountType: item.discountType ?? null,
        discountValue: item.discountValue ?? null,
      })),
      discountType: discountType ?? null,
      discountValue: discountValue ?? null,
      payments: this.paymentsArray.value.map((payment: CheckoutDraftPayment) => {
        const method = (this.paymentMethodsQuery.data() ?? []).find(
          (item) => item.id === payment.paymentMethodId,
        );
        return {
          paymentMethodId: payment.paymentMethodId ?? null,
          code: method?.code ?? '',
          name: method?.name ?? '',
          amount: payment.amount ?? 0,
        };
      }),
      paymentTermId: paymentTermId ?? null,
    }));
    this.draftService.persist();
  }

  private restoreDraft() {
    const draft = this.draftService.draft();
    this.documentType.set(draft.documentType);
    this.documentTypeId.set(draft.documentTypeId);
    if (draft.documentType === CheckoutDocumentType.TAX_CREDIT) {
      this.checkoutForm
        .get('customerId')
        ?.setValidators([Validators.required]);
    }
    this.checkoutForm.patchValue({
      customerId: draft.customerId,
      discountType: draft.discountType,
      discountValue: draft.discountValue,
      paymentTermId: draft.paymentTermId,
    });
    if (draft.customerId) {
      this.selectedCustomer.set({
        id: draft.customerId,
        name: draft.customerName ?? '',
      });
    }
    draft.items.forEach((item) => {
      this.itemsArray.push(
        this.fb.group({
          productId: [item.productId],
          name: [item.name],
          quantity: [item.quantity, [Validators.required, Validators.min(1)]],
          zoneId: [item.zoneId, Validators.required],
          zoneName: [item.zoneName ?? ''],
          unitPrice: [item.unitPrice ?? null],
          unitPriceEstimate: [item.unitPriceEstimate],
          lineTotal: [item.lineTotal],
          discountType: [item.discountType],
          discountValue: [item.discountValue],
        }),
      );
    });
    draft.payments.forEach((payment) => {
      this.paymentsArray.push(
        this.fb.group({
          paymentMethodId: [
            payment.paymentMethodId,
            [Validators.required],
          ],
          amount: [
            payment.amount,
            [Validators.required, Validators.min(0.01)],
          ],
        }),
      );
    });
    this.itemsSnapshot.set(this.itemsArray.value);
    this.paymentsSnapshot.set(this.paymentsArray.value);
    // El borrador restaurado cuenta como trabajo en curso: sin esto el
    // submit sale en silencio por el gate de `dirty` tras recargar.
    if (draft.items.length > 0 || draft.payments.length > 0 || draft.customerId) {
      this.checkoutForm.markAsDirty();
    }
  }

  private destroyed = false;
  private readonly destroyed$ = new Subject<void>();

  private formChangesSubscription?: { unsubscribe: () => void };

  async ngOnInit(): Promise<void> {
    this.cdr?.markForCheck();
    const source = this.activatedRoute.snapshot.queryParamMap.get('quotationId');
    if (source !== null) {
      const id = Number(source);
      this.isLoading.set(true);
      try {
        if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid quotation ID');
        const quotation = await firstValueFrom(this.quotationService.getQuotation(id).pipe(takeUntil(this.destroyed$)));
        if (this.destroyed) return;
        this.draftService.seedFromQuotation(quotation);
        await this.router.navigate([], { relativeTo: this.activatedRoute, queryParams: { quotationId: null }, queryParamsHandling: 'merge', replaceUrl: true });
      } catch {
        if (this.destroyed) return;
        this.alertService.showError('No se pudo cargar la cotización. La venta no fue creada.');
        await this.router.navigate(['/quotations/list']);
        return;
      } finally {
        this.isLoading.set(false);
        this.cdr?.markForCheck();
      }
    }
    if (this.destroyed) return;
    this.restoreDraft();
    this.formChangesSubscription = this.checkoutForm.valueChanges.subscribe(
      () => {
        this.itemsSnapshot.set(this.itemsArray.value);
        this.paymentsSnapshot.set(this.paymentsArray.value);
        this.syncDraft();
        this.cdr?.markForCheck();
      },
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.closeAttachmentPreview();
    this.destroyed$.next();
    this.destroyed$.complete();
    this.formChangesSubscription?.unsubscribe();
  }
}
