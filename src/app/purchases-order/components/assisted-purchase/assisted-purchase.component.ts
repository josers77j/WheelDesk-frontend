import { ConstructionPipe } from '../../../products/pipes/construction.pipe';
import { duplicatePurchaseProducts, productWithPurchaseCost } from './purchase-duplicates.util';
import { ConfirmActionModalComponent } from '../../../shared/components/confirm-action-modal/confirm-action-modal.component';
import { QuickViewComponent as ProductQuickViewComponent } from '../../../products/components/quick-view/quick-view.component';
import { PRODUCT_TYPE } from '../../../products/interfaces/product-type.enum';
import { PdfPreviewComponent } from '../../../shared/components/pdf-preview/pdf-preview.component';
import { ApproveModalComponent } from '../approve-modal/approve-modal.component';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  input,
  OnChanges,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import {
  FormsModule,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { QueryClient } from '@tanstack/angular-query-experimental';
import Decimal from 'decimal.js';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { ComboboxFormControlComponent } from '../../../shared/components/combobox-form-control/combobox-form-control.component';
import { ValueParams } from '../../../shared/components/combobox/interfaces/search-param.interface';
import { BrandService } from '../../../brands/services/brand.service';
import { ProviderService } from '../../../providers/services/provider.service';
import { emptyProduct, ProductService } from '../../../products/services/product.service';
import { WarehouseService } from '../../../warehouses/services/warehouse.service';
import { ZoneService } from '../../../zones/services/zone.service';
import { PurchaseOrder } from '../../interfaces/purchase-order.interface';
import { PURCHASE_ORDER_STATUS } from '../../enums/purchase-order-status.enum';
import { AssistedPurchaseService } from '../../services/assisted-purchase.service';
import {
  AssistedPurchasePayload,
  AssistedPurchaseLine,
  PurchaseRowDraft,
  PurchaseSourcePreview,
} from '../../interfaces/assisted-purchase.interface';
import {
  Product,
  CONSTRUCTION,
  ProductTirePayload,
} from '../../../products/interfaces/product.interface';
import { TireFormModalComponent } from '../../../products/components/tire-form-modal/tire-form-modal.component';
import { SupplyFormModalComponent } from '../../../products/components/supply-form-modal/supply-form-modal.component';
import { purchaseDescription } from './purchase-description.util';
import { invalidateCatalogCaches } from '../../../shared/utils/invalidate-catalog-caches.util';

@Component({
  selector: 'app-assisted-purchase',
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    CurrencyPipe,
    AlertComponent,
    ComboboxFormControlComponent,
    TireFormModalComponent,
    SupplyFormModalComponent,
    ApproveModalComponent,
    PdfPreviewComponent,
    ConfirmActionModalComponent,
    ProductQuickViewComponent,
  ],
  templateUrl: './assisted-purchase.component.html',
  styleUrl: './assisted-purchase.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistedPurchaseComponent implements OnChanges {
  readonly purchaseOrder = input<PurchaseOrder | null>(null);
  readonly editingOrder = signal<PurchaseOrder | null>(null);
  private readonly editBaseline = signal('');
  readonly hasEditChanges = computed(
    () => !this.isEditing() || this.editSignature() !== this.editBaseline(),
  );
  readonly isEditing = computed(() => !!this.editingOrder()?.id);
  readonly readOnly = computed(
    () =>
      this.isEditing() &&
      this.editingOrder()?.status !== PURCHASE_ORDER_STATUS.PENDING,
  );
  private readonly service = inject(AssistedPurchaseService);
  private readonly purchaseOrders = inject(PurchaseOrderService);
  readonly savedOrderId = signal<number | null>(null);
  readonly orderToApprove = signal<PurchaseOrder | null>(null);
  readonly loadingApproval = signal(false);
  readonly approvalChoice = viewChild<ElementRef<HTMLDialogElement>>('approvalChoice');
  readonly approvalModal = viewChild(ApproveModalComponent);

  async approveLater(): Promise<void> {
    if (this.loadingApproval()) return;
    this.approvalChoice()?.nativeElement.close();
    await this.router.navigate(['/purchase-orders/list']);
  }

  async approveNow(): Promise<void> {
    const id = this.savedOrderId();
    if (!id || this.loadingApproval()) return;
    this.loadingApproval.set(true);
    try {
      const order = await firstValueFrom(this.purchaseOrders.getPurchaseOrder(id));
      this.cdr?.markForCheck();
      if (this.destroyed) return;
      this.orderToApprove.set(order);
      this.approvalChoice()?.nativeElement.close();
      this.approvalModal()?.openModal();
    } catch {
      if (!this.destroyed) this.alerts.showError('La compra está guardada, pero no se pudo cargar para aprobar. Puede reintentar o aprobarla después.');
    } finally {
      if (!this.destroyed) this.loadingApproval.set(false);
    }
  }

  approvalClosed(): void {
    if (!this.destroyed) this.approvalChoice()?.nativeElement.showModal();
  }

  async approvalCompleted(): Promise<void> {
    this.savedOrderId.set(null);
    await this.router.navigate(['/purchase-orders/list']);
  }
  private readonly providers = inject(ProviderService);
  private readonly brands = inject(BrandService);
  private readonly products = inject(ProductService);
  private readonly zones = inject(ZoneService);
  private readonly warehouses = inject(WarehouseService);
  private readonly alerts = inject(AlertService);
  private readonly router = inject(Router);
  private readonly queries = inject(QueryClient);
  private readonly fb = inject(FormBuilder);
  readonly cdr = inject(ChangeDetectorRef, { optional: true });
  private destroyed = false;
  private version = 0;
  private requestId = crypto.randomUUID();
  private submitted: {
    payload: AssistedPurchasePayload;
    files: File[];
  } | null = null;
  private editingKey = '';
  readonly mode = signal<'MANUAL' | 'DOCUMENT'>('MANUAL');
  readonly providerMode = signal<'existing' | 'new'>('existing');
  readonly busy = signal(false);
  readonly interpreting = signal(false);
  readonly uncertain = signal(false);
  readonly attempted = signal(false);
  readonly touched = signal({
    provider: false,
    warehouse: false,
    products: false,
    document: false,
  });
  touch(key: 'provider' | 'warehouse' | 'products' | 'document'): void {
    this.touched.update((value) => ({ ...value, [key]: true }));
    this.cdr?.markForCheck();
  }
  readonly rows = signal<PurchaseRowDraft[]>([]);
  readonly collapsedProducts = signal<ReadonlySet<string>>(new Set());
  toggleProduct(key: string): void {
    this.collapsedProducts.update(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  readonly pdfConfirmed = signal(false);
  readonly pdf = signal<File | null>(null);
  readonly json = signal<File | null>(null);
  readonly sourceReady = signal(false);
  readonly source = signal<PurchaseSourcePreview | null>(null);
  readonly providerOptions = signal<ValueParams[]>([]);
  readonly providerLoading = signal(false);
  readonly selectedProvider = signal<ValueParams | null>(null);
  readonly interpretationHintDismissed = signal(false);
  readonly draggingFiles = signal(false);
  readonly rowsHaveDestination = computed(() => this.rows().some(row => !!row.suggestedZoneId));
  searchMatchTerm(): void { const row = this.matchRow(); if (row) void this.findMatches(row, this.matchTerm()); }
  readonly matchDialog = viewChild<ElementRef<HTMLDialogElement>>('matchDialog');
  readonly matchRow = signal<PurchaseRowDraft | null>(null);
  readonly matchResults = signal<Product[]>([]);
  readonly matchTerm = signal('');
  readonly matchLoading = signal(false);
  private matchVersion = 0;
  readonly quickProduct = signal<Product | null>(null);
  readonly quickLoading = signal(false);
  readonly productQuickView = viewChild(ProductQuickViewComponent);
  private readonly productDetails = new Map<number, Product>();
  readonly decisionModal = viewChild(ConfirmActionModalComponent);
  readonly decisionMessage = signal('');
  readonly decisionTitle = signal('Confirmar cambio');
  readonly decisionConfirmLabel = signal('Continuar');
  readonly decisionCancelLabel = signal('Cancelar');
  readonly quickDraft = signal(false);
  readonly quickPurchaseContext = signal<{ quantity: number; unitPrice: string } | null>(null);
  private resolvingDuplicates = false;
  private decisionResolve?: (confirmed: boolean) => void;

  resolveDecision(confirmed: boolean): void {
    const resolve = this.decisionResolve;
    this.decisionResolve = undefined;
    resolve?.(confirmed);
  }
  private ask(message: string, duplicate = false): Promise<boolean> {
    if (this.decisionResolve) return Promise.resolve(false);
    this.decisionMessage.set(message);
    this.decisionTitle.set(duplicate ? 'Producto duplicado' : 'Confirmar cambio');
    this.decisionConfirmLabel.set(duplicate ? 'Unificar y sumar cantidades' : 'Continuar');
    this.decisionCancelLabel.set(duplicate ? 'Modificar' : 'Cancelar');
    return new Promise(resolve => {
      this.decisionResolve = resolve;
      this.decisionModal()?.open();
      if (!this.decisionModal()) this.resolveDecision(false);
    });
  }
  async filesDropped(event: DragEvent): Promise<void> {
    event.preventDefault(); this.draggingFiles.set(false);
    if (!this.locked()) await this.attachFiles(Array.from(event.dataTransfer?.files ?? []));
  }
  rowSubtotal(row: PurchaseRowDraft): string {
    try { return new Decimal(row.unitPrice || 0).times(row.quantity || 0).toFixed(4); }
    catch { return '0'; }
  }
  setNewProduct(row: PurchaseRowDraft, value: boolean): void {
    if (this.locked()) return;
    row.choice = value ? 'new' : 'existing';
    this.changeRow(row);
    if (!value && this.mode() === 'DOCUMENT') void this.findMatches(row);
  }
  private readonly constructionLabel = new ConstructionPipe();
  rowName(row: PurchaseRowDraft): string {
    if (row.choice === 'existing') return row.selected?.name ?? '';
    if (row.product?.supply) return row.product.supply.name ?? '';
    const tire = row.product?.tire?.tire;
    if (!row.ready || !tire) return '';
    return `${tire.width ?? ''}${tire.aspectRatio ? '/' + tire.aspectRatio : ''}${this.constructionLabel.transform(tire.construction)}${tire.rimDiameter ?? ''} ${row.brandName}`.trim();
  }
  async showProduct(row: PurchaseRowDraft): Promise<void> {
    if (row.type !== 'TIRE' && row.type !== 'SUPPLY') return;
    this.quickPurchaseContext.set({ quantity: row.quantity, unitPrice: row.unitPrice });
    if (row.choice === 'new' && row.ready && row.product) {
      const draft = row.product;
      const body = draft.tire ?? draft.supply;
      const tire = draft.tire?.tire;
      this.quickDraft.set(true);
      this.quickProduct.set({
        ...emptyProduct, name: this.rowName(row), type: draft.type,
        brand: { id: draft.brandId ?? 0, name: row.brandName }, brandId: draft.brandId ?? null,
        salePrice: body?.salePrice ?? '', purchasePrice: row.unitPrice || body?.purchasePrice || '',
        notes: body?.notes ?? null, itemTypeCatalogId: body?.itemTypeCatalogId,
        unitOfMeasureCatalogId: body?.unitOfMeasureCatalogId,
        itemTypeCatalog: row.draftCatalog?.item, unitOfMeasureCatalog: row.draftCatalog?.unit,
        productVehicleType: row.draftVehicleTypes,
        tire: tire ? { prefix: tire.prefix ?? '', width: tire.width ?? 0, aspectRatio: tire.aspectRatio ?? null,
          construction: tire.construction ?? CONSTRUCTION.RADIAL, rimDiameter: String(tire.rimDiameter ?? ''),
          loadIndexFront: tire.loadIndexFront ?? null, loadIndexRear: tire.loadIndexRear ?? null,
          speedRating: tire.speedRating ?? null, loadRange: tire.loadRange ?? '', plies: tire.plies ?? null,
          vehicleTypeId: tire.vehicleTypeId ?? [], condition: tire.condition ?? null, quality: tire.quality ?? null } : null,
      });
      this.productQuickView()?.openModal();
      return;
    }
    if (!row.productId || !row.type || this.quickLoading()) return;
    const selectedId = row.productId;
    const selectedType = row.type;
    this.quickLoading.set(true);
    try {
      const product = this.productDetails.get(row.productId) ?? await firstValueFrom(this.products.getProductById(row.productId, row.type === 'TIRE' ? PRODUCT_TYPE.TIRE : PRODUCT_TYPE.SUPPLY));
      this.cdr?.markForCheck();
      if (this.destroyed || row.productId !== selectedId || row.type !== selectedType) return;
      this.productDetails.set(product.id, product);
      this.quickDraft.set(false);
      this.quickProduct.set(product);
      this.productQuickView()?.openModal();
    } catch { if (!this.destroyed) this.alerts.showError('No se pudo consultar el producto.'); }
    finally { if (!this.destroyed) this.quickLoading.set(false); }
  }
  async findMatches(row: PurchaseRowDraft, term?: string): Promise<void> {
    if (this.locked() || !row.type) {
      if (!row.type) this.alerts.showWarning('Seleccione el tipo de producto para buscar.');
      return;
    }
    this.matchRow.set(row); this.matchTerm.set(term ?? row.searchText ?? row.description);
    this.matchResults.set([]); this.matchDialog()?.nativeElement.showModal();
    const version = ++this.matchVersion;
    this.matchLoading.set(true);
    try {
      const parsed = purchaseDescription(row.description, this.source()?.brands ?? []);
      const filters = term === undefined && row.type === 'TIRE' && parsed.width && parsed.rimDiameter
        ? { width: parsed.width, aspectRatio: parsed.aspectRatio, rimDiameter: parsed.rimDiameter, brandId: row.brandSelected?.id }
        : { filter: this.matchTerm().trim() };
      const result = await firstValueFrom(this.products.getProducts(row.type, 1, 30, filters));
      this.cdr?.markForCheck();
      if (this.destroyed || version !== this.matchVersion) return;
      this.matchResults.set(result.data);
      if (!result.data.length) this.alerts.showWarning('No se encontraron coincidencias. Puede buscar manualmente en el catálogo.');
    } catch { if (!this.destroyed && version === this.matchVersion) this.alerts.showError('No se pudieron buscar coincidencias.'); }
    finally { if (!this.destroyed && version === this.matchVersion) this.matchLoading.set(false); }
  }
  useMatch(product: Product): void {
    const row = this.matchRow();
    if (!row || this.locked() || (product.type !== 'TIRE' && product.type !== 'SUPPLY')) return;
    row.type = product.type; row.choice = 'existing';
    this.productDetails.set(product.id, product);
    this.chooseProduct(row, product); this.closeMatches();
  }
  closeMatches(): void {
    this.matchVersion++; this.matchLoading.set(false);
    this.matchDialog()?.nativeElement.close(); this.matchRow.set(null);
  }
  async searchRowZones(row: PurchaseRowDraft, term: string): Promise<void> {
    const warehouseId = row.warehouse?.id;
    if (this.locked() || !warehouseId) return;
    const version = (row.zoneVersion ?? 0) + 1;
    row.zoneVersion = version; row.zoneLoading = true; this.rows.update(rows => [...rows]);
    try {
      const values = await firstValueFrom(this.zones.getZonesByName(30, term, undefined, warehouseId));
      this.cdr?.markForCheck();
      if (!this.destroyed && row.zoneVersion === version && row.warehouse?.id === warehouseId) row.zoneOptions = values.map(value => ({ id: value.id, name: value.name.split(' / ').pop()?.trim() || value.name }));
    } catch { if (!this.destroyed && row.zoneVersion === version) this.alerts.showError('No se pudieron consultar zonas.'); }
    finally { if (!this.destroyed && row.zoneVersion === version) { row.zoneLoading = false; this.rows.update(rows => [...rows]); } }
  }
  chooseRowWarehouse(row: PurchaseRowDraft, value: ValueParams | null): void {
    if (this.locked() || row.warehouse?.id === value?.id) return;
    row.warehouse = value; row.zone = null; row.suggestedZoneId = undefined;
    row.zoneOptions = []; row.zoneVersion = (row.zoneVersion ?? 0) + 1; row.zoneLoading = false;
    this.markChanged();
  }
  chooseRowZone(row: PurchaseRowDraft, value: ValueParams | null): void {
    if (this.locked() || !row.warehouse || (value && !row.zoneOptions?.some(zone => zone.id === value.id))) return;
    row.zone = value; row.suggestedZoneId = value?.id; this.markChanged();
  }
  readonly warehouseOptions = signal<ValueParams[]>([]);
  readonly previewDialog =
    viewChild<ElementRef<HTMLDialogElement>>('previewDialog');
  readonly tireModal = viewChild(TireFormModalComponent);
  readonly supplyModal = viewChild(SupplyFormModalComponent);
  readonly previewText = signal('');
  readonly providerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    nrc: [
      '',
      [
        Validators.pattern(/^(?=.*\d)[\d\s-]+$/),
        Validators.maxLength(30),
      ],
    ],
    nit: [
      '',
      [
        Validators.pattern(/^(?=.*\d)[\d\s-]+$/),
        Validators.maxLength(30),
      ],
    ],
    phone: ['', [Validators.maxLength(30)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
  });
  readonly locked = computed(
    () =>
      this.busy() || this.interpreting() || this.uncertain() || this.readOnly() || this.savedOrderId() !== null,
  );
  readonly total = computed(() =>
    this.rows()
      .reduce((sum, row) => {
        try {
          return sum.plus(
            new Decimal(row.unitPrice || 0).times(row.quantity || 0),
          );
        } catch {
          return sum;
        }
      }, new Decimal(0))
      .toFixed(2),
  );
  readonly providerValid = computed(() =>
    this.providerMode() === 'existing' ? !!this.selectedProvider() : false,
  );
  readonly productsValid = computed(
    () =>
      this.rows().length > 0 && this.rows().every((row) => this.rowValid(row)),
  );
  readonly duplicateProducts = computed(() => duplicatePurchaseProducts(this.rows()));
  private readonly duplicateRows = computed(() => {
    const result = new Map<string, number[]>();
    for (const group of this.duplicateProducts()) for (const index of group) {
      const row = this.rows()[index - 1];
      if (row) result.set(row.key, group);
    }
    return result;
  });
  duplicateGroup(row: PurchaseRowDraft): number[] | undefined { return this.duplicateRows().get(row.key); }
  duplicateQuantity(group: readonly number[]): number { return group.reduce((sum, index) => sum + (this.rows()[index - 1]?.quantity ?? 0), 0); }
  modifyDuplicate(row: PurchaseRowDraft): void {
    if (this.locked()) return;
    this.collapsedProducts.update(current => { const next = new Set(current); next.delete(row.key); return next; });
    if (row.choice === 'new') this.prepare(row);
    else {
      const target = Array.from(this.host?.nativeElement.querySelectorAll<HTMLElement>('[data-purchase-row]') ?? [])
        .find(element => element.dataset['purchaseRow'] === row.key);
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      target?.querySelector<HTMLElement>('select, input, button')?.focus({ preventScroll: true });
    }
  }

  readonly warnings = computed(() =>
    this.rows()
      .filter((row) => !this.rowValid(row))
      .map(
        (row) =>
          `Producto ${this.rows().indexOf(row) + 1}: ${row.choice === 'new' ? 'confirme marca, tipo, precio de venta y atributos requeridos.' : 'seleccione el producto correcto.'}`,
      ),
  );

  readonly duplicateBanner = viewChild<ElementRef<HTMLElement>>('duplicateBanner');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef, { optional: true });
  private scrollFrame?: number;
  private scrollToFeedback(): void {
    this.collapsedProducts.update(current => {
      const next = new Set(current);
      for (const row of this.rows()) if (!this.rowValid(row) || this.duplicateGroup(row)) next.delete(row.key);
      return next;
    });
    if (this.scrollFrame !== undefined) cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = undefined;
      if (this.destroyed) return;
      const target = this.duplicateBanner()?.nativeElement
        ?? this.host?.nativeElement.querySelector<HTMLElement>('[role="alert"], .input-error, .select-error');
      target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    });
  }
  constructor() {
    let previousDuplicates = '';
    effect(() => {
      const signature = JSON.stringify(this.duplicateProducts());
      if (this.duplicateProducts().length && signature !== previousDuplicates) {
        this.scrollToFeedback();
        if (!this.resolvingDuplicates) void this.resolveDuplicateProducts();
      }
      previousDuplicates = signature;
    });
    const formChanges = this.providerForm.valueChanges.subscribe(() =>
      this.cdr?.markForCheck(),
    );
    inject(DestroyRef).onDestroy(() => {
      formChanges.unsubscribe();
      this.destroyed = true;
      if (this.scrollFrame !== undefined) cancelAnimationFrame(this.scrollFrame);
      this.version++;
      this.revokePreview();
      this.resolveDecision(false);
      this.matchVersion++;
    });
  }
  ngOnChanges(): void {
    this.loadOrder(this.purchaseOrder());
  }
  loadOrder(order: PurchaseOrder | null): void {
    this.reset();
    this.editingOrder.set(order?.id ? order : null);
    if (!order?.id) return;
    this.mode.set(order.sourceIdentity ? 'DOCUMENT' : 'MANUAL');
    const snapshot =
      order.document?.source === 'JSON' ? order.document.sourceSnapshot : null;
    this.sourceReady.set(!!snapshot);
    if (snapshot) {
      this.source.set({ ...snapshot, brands: [], providerMatch: null });
      this.pdfConfirmed.set(snapshot.pdfConfirmed ?? false);
    }
    this.selectedProvider.set({
      id: order.provider.id,
      name: order.provider.name,
    });
    this.rows.set(
      order.details.map((detail, index) => ({
        key: crypto.randomUUID(),
        description: snapshot?.lines[index]?.description ?? detail.product.name,
        sourceLine: snapshot?.lines[index]?.number,
        quantity: detail.quantity,
        unitPrice: detail.unitPrice,
        productId: detail.product.id,
        selected: detail.product,
        choice: 'existing',
        type:
          detail.product.type === 'TIRE' || detail.product.type === 'SUPPLY'
            ? detail.product.type
            : '',
        brandName: '',
        brandMode: 'existing',
        ready: true,
        suggestedZoneId: detail.suggestedZoneId ?? undefined,
        warehouse: detail.suggestedZone?.warehouse ?? null,
        zone: detail.suggestedZone ? { id: detail.suggestedZone.id, name: detail.suggestedZone.name } : null,
        zoneOptions: detail.suggestedZone ? [{ id: detail.suggestedZone.id, name: detail.suggestedZone.name }] : [],
      })),
    );
    this.editBaseline.set(this.editSignature());
  }
  private editSignature(): string {
    return JSON.stringify({
      providerMode: this.providerMode(),
      providerId: this.selectedProvider()?.id,
      provider:
        this.providerMode() === 'new'
          ? this.providerForm.getRawValue()
          : undefined,
      details: this.rows().map((row) => ({
        description: row.description,
        sourceLine: row.sourceLine,
        productId: row.productId,
        product: row.choice === 'new' ? row.product : undefined,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        suggestedZoneId: row.suggestedZoneId,
      })),
    });
  }
  async resolveDuplicateProducts(): Promise<boolean> {
    if (this.resolvingDuplicates || this.decisionResolve) return false;
    this.resolvingDuplicates = true;
    try {
      while (this.duplicateProducts().length) {
        const group = this.duplicateProducts()[0];
        const keys = group.map(index => this.rows()[index - 1]?.key);
        const confirmed = await this.ask(`Las líneas ${group.join(', ')} tienen los mismos datos de producto, costo y destino. ¿Se desean unificar en una sola línea sumando sus cantidades, o modificar sus datos para diferenciarlas?`, true);
        if (!confirmed || this.destroyed) return false;
        const current = this.duplicateProducts().find(indices => indices.map(index => this.rows()[index - 1]?.key).join('|') === keys.join('|'));
        if (!current) continue;
        const members = current.map(index => this.rows()[index - 1]).filter((row): row is PurchaseRowDraft => !!row);
        const quantity = members.reduce((sum, row) => sum + row.quantity, 0);
        if (members.some(row => !Number.isInteger(row.quantity) || row.quantity <= 0) || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 2147483647) {
          this.alerts.showError('La cantidad unificada supera el límite admitido o contiene una cantidad inválida. Revise las líneas.');
          return false;
        }
        const first = members[0];
        const removed = new Set(members.slice(1).map(row => row.key));
        const sourceLines = members.flatMap(row => row.sourceLines ?? (row.sourceLine ? [row.sourceLine] : []));
        this.rows.update(rows => rows.filter(row => !removed.has(row.key)).map(row => row.key === first.key ? { ...row, quantity, ...(sourceLines.length ? { sourceLines } : {}) } : row));
        this.markChanged();
      }
      return true;
    } finally { this.resolvingDuplicates = false; }
  }
  private payloadDetails(): AssistedPurchaseLine[] {
    const lines = this.rows().flatMap(row => this.payloadLines(row));
    if (this.mode() !== 'DOCUMENT') return lines;
    const order = new Map(this.source()?.lines.map((line, index) => [line.number, index]));
    return lines.sort((a, b) => (order.get(a.sourceLine ?? 0) ?? 0) - (order.get(b.sourceLine ?? 0) ?? 0));
  }
  private payloadLines(row: PurchaseRowDraft): AssistedPurchaseLine[] {
    const base: AssistedPurchaseLine = {
      key: row.key, description: row.description, sourceLine: row.sourceLine,
      quantity: row.quantity, unitPrice: String(row.unitPrice), suggestedZoneId: row.suggestedZoneId,
      ...(row.choice === 'existing' ? { productId: row.productId } : { product: row.product ? productWithPurchaseCost(row.product, row.unitPrice) : undefined }),
    };
    if (this.mode() !== 'DOCUMENT' || !row.sourceLines?.length) return [base];
    const originals = new Map(this.source()?.lines.map(line => [line.number, line]));
    return row.sourceLines.map((number, index) => {
      const original = originals.get(number);
      if (!original) throw new Error('No se encontró la línea original del documento.');
      return { ...base, key: index === 0 ? row.key : crypto.randomUUID(), sourceLine: number,
        quantity: original.quantity, unitPrice: original.unitPrice, description: original.description };
    });
  }
  markChanged(): void {
    this.rows.update((rows) => [...rows]);
    this.requestId = crypto.randomUUID();
    this.cdr?.markForCheck();
  }
  providerComplete(): boolean {
    return this.providerMode() === 'existing'
      ? !!this.selectedProvider()
      : this.providerForm.valid;
  }
  rowValid(row: PurchaseRowDraft): boolean {
    let cost: Decimal;
    try {
      cost = new Decimal(row.unitPrice);
    } catch {
      return false;
    }
    return (
      Number.isInteger(row.quantity) &&
      row.quantity > 0 &&
      row.quantity <= 2147483647 &&
      /^\d{1,10}(?:\.\d{1,4})?$/.test(row.unitPrice) &&
      cost.isFinite() &&
      cost.gt(0) &&
      cost.decimalPlaces() <= 4 &&
      (row.choice === 'existing'
        ? !!row.productId
        : row.choice === 'new' &&
          row.ready &&
          !!row.product &&
          (row.brandMode === 'new'
            ? !!row.brandName.trim()
            : !!row.brandSelected) &&
          Number(row.product.tire?.salePrice ?? row.product.supply?.salePrice) >
            0)
    );
  }
  providerFieldError(
    field: 'name' | 'nrc' | 'nit' | 'phone' | 'email',
  ): string | null {
    const control = this.providerForm.controls[field];
    if (!control.invalid || !(control.touched || this.attempted())) return null;
    if (control.hasError('required')) return '* Obligatorio';
    if (control.hasError('email')) return 'Ingrese un correo válido.';
    if (control.hasError('pattern'))
      return 'Ingrese un identificador válido: números, espacios o guiones.';
    return 'Revise la longitud del dato ingresado.';
  }
  rowFieldError(
    row: PurchaseRowDraft,
    field: 'type' | 'choice' | 'quantity' | 'cost' | 'product' | 'brand',
  ): string | null {
    if (!(this.attempted() || row.validationAttempted)) return null;
    switch (field) {
      case 'type':
        return row.type || row.productId ? null : '* Obligatorio';
      case 'choice':
        return row.choice ? null : '* Obligatorio';
      case 'product':
        return row.productId ? null : '* Obligatorio';
      case 'brand':
        return (
          row.brandMode === 'new' ? row.brandName.trim() : row.brandSelected
        )
          ? null
          : '* Obligatorio';
      case 'quantity':
        return row.quantity == null
          ? '* Obligatorio'
          : Number.isInteger(row.quantity) &&
              row.quantity > 0 &&
              row.quantity <= 2147483647
            ? null
            : 'Ingrese una cantidad entera mayor que cero.';
      case 'cost': {
        if (!row.unitPrice || row.unitPrice === 'null') return '* Obligatorio';
        try {
          return /^\d{1,10}(?:\.\d{1,4})?$/.test(row.unitPrice) &&
            new Decimal(row.unitPrice).gt(0)
            ? null
            : 'Ingrese un costo mayor que cero, con hasta cuatro decimales.';
        } catch {
          return 'Ingrese un costo válido.';
        }
      }
    }
  }
  async switchMode(mode: 'MANUAL' | 'DOCUMENT'): Promise<void> {
    if (this.locked() || mode === this.mode()) return;
    if (
      !await this.confirmReset(
        'Cambiar la modalidad reinicia los productos, proveedor y adjuntos.',
      )
    )
      return;
    this.reset();
    this.mode.set(mode);
  }
  private async confirmReset(message: string): Promise<boolean> {
    return (
      (!this.rows().length && !this.pdf() && !this.json()) ||
      await this.ask(`${message} ¿Continuar?`)
    );
  }
  reset(): void {
    this.version++;
    this.interpretationHintDismissed.set(false);
    this.rows.set([]);
    this.pdf.set(null);
    this.pdfConfirmed.set(false);
    this.json.set(null);
    this.sourceReady.set(false);
    this.source.set(null);
    this.providerForm.reset();
    this.selectedProvider.set(null);
    this.providerMode.set('existing');
    this.attempted.set(false);
    this.touched.set({
      provider: false,
      warehouse: false,
      products: false,
      document: false,
    });
    this.submitted = null;
    this.uncertain.set(false);
    this.requestId = crypto.randomUUID();
    this.revokePreview();
  }
  async filesChanged(event: Event): Promise<void> {
    if (this.locked() || !(event.target instanceof HTMLInputElement)) return;
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    await this.attachFiles(files);
  }
  private async attachFiles(files: File[]): Promise<void> {
    if (this.locked()) return;
    if (
      files.some((file) => file.size > 512 * 1024) ||
      files.filter((file) => file.name.toLowerCase().endsWith('.pdf')).length >
        1 ||
      files.filter((file) => file.name.toLowerCase().endsWith('.json')).length >
        1 ||
      files.some((file) => !/\.(pdf|json)$/i.test(file.name))
    ) {
      this.alerts.showWarning(
        'Adjunte como máximo un PDF y un JSON, de hasta 512 KB cada uno.',
      );
      return;
    }
    for (const file of files) {
      const isJson = /\.json$/i.test(file.name);
      const previous = isJson ? this.json() : this.pdf();
      if (
        previous &&
        !await this.ask(
          `¿Reemplazar ${previous.name}? ${isJson && this.sourceReady() ? 'Se reiniciarán los datos interpretados.' : ''}`,
        )
      )
        continue;
      if (isJson && this.sourceReady()) this.clearSource();
      if (isJson) { this.json.set(file); this.interpretationHintDismissed.set(false); }
      else {
        this.pdf.set(file);
        this.pdfConfirmed.set(false);
      }
    }
    this.requestId = crypto.randomUUID();
  }
  async removeFile(kind: 'PDF' | 'JSON'): Promise<void> {
    if (this.locked()) return;
    if (
      kind === 'JSON' &&
      this.sourceReady() &&
      !await this.ask(
        'Este JSON originó los productos. Quitarlo reinicia esos datos. ¿Continuar?',
      )
    )
      return;
    if (kind === 'JSON') {
      this.json.set(null);
      this.clearSource();
    } else {
      this.pdf.set(null);
      this.pdfConfirmed.set(false);
    }
    this.requestId = crypto.randomUUID();
    this.revokePreview();
  }
  private clearSource(): void {
    this.version++;
    this.interpretationHintDismissed.set(false);
    this.rows.set([]);
    this.source.set(null);
    this.sourceReady.set(false);
    this.selectedProvider.set(null);
    this.providerForm.reset();
  }
  private async matchInterpretedProducts(version: number): Promise<void> {
    const pending = new Map<string, Promise<Product[]>>();
    const rows = [...this.rows()];
    let cursor = 0;
    const searchNext = async (): Promise<void> => {
      while (cursor < rows.length && !this.destroyed && version === this.version) {
        const row = rows[cursor++];
        const parsed = purchaseDescription(row.description, this.source()?.brands ?? []);
        if (row.type !== 'TIRE' || !row.brandSelected || !parsed.width || !parsed.aspectRatio || !parsed.rimDiameter) continue;
        const filters = { width: parsed.width, aspectRatio: parsed.aspectRatio, rimDiameter: parsed.rimDiameter, brandId: row.brandSelected.id };
        const key = JSON.stringify(filters);
        let request = pending.get(key);
        if (!request) {
          request = firstValueFrom(this.products.getProducts('TIRE', 1, 2, filters)).then(result => result.data);
          pending.set(key, request);
        }
        try {
          const products = await request;
          if (this.destroyed || version !== this.version) return;
          if (products.length !== 1 || products[0].type !== 'TIRE') continue;
          const product = products[0];
          row.productId = product.id;
          row.selected = product;
          row.product = undefined;
          row.ready = true;
          this.productDetails.set(product.id, product);
        } catch {
          // Keep the source line available for manual catalog selection.
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, rows.length) }, () => searchNext()));
    if (!this.destroyed && version === this.version) {
      this.rows.update(current => [...current]);
      this.cdr?.markForCheck();
    }
  }
  async interpret(): Promise<void> {
    if (this.locked()) return;
    const file = this.json();
    if (file) this.interpretationHintDismissed.set(true);
    if (!file) {
      this.alerts.showWarning(
        'Se necesita el JSON de la factura para interpretar. El PDF solo se adjunta como respaldo.',
      );
      return;
    }
    if (this.sourceReady()) {
      this.alerts.showWarning(
        'El documento ya fue interpretado. Las correcciones se conservan sin duplicar líneas.',
      );
      return;
    }
    if (
      this.rows().length &&
      !await this.ask(
        'Interpretar reemplazará los productos actuales. ¿Continuar?',
      )
    )
      return;
    this.touch('document');
    this.interpreting.set(true);
    const version = ++this.version;
    try {
      const preview = await firstValueFrom(this.service.preview(file));
      this.cdr?.markForCheck();
      if (this.destroyed || version !== this.version) return;
      this.source.set(preview);
      this.providerForm.patchValue(preview.provider);
      this.sourceReady.set(true);
      if (preview.providerMatch) {
        this.providerMode.set('existing');
        this.selectedProvider.set({
          id: preview.providerMatch.id,
          name: preview.providerMatch.name,
        });
      } else {
        this.providerMode.set('new');
        this.selectedProvider.set(null);
      }
      this.rows.set(
        preview.lines.map((line) => {
          const guessed = purchaseDescription(line.description, preview.brands);
          return {
            key: crypto.randomUUID(),
            description: line.description,
            sourceLine: line.number,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            choice: 'existing',
            type: guessed.type,
            brandName: guessed.brandName,
            brandMode: 'existing',
            brandSelected:
              preview.brands.find(
                (brand) =>
                  brand.name.trim().toUpperCase() ===
                  guessed.brandName.trim().toUpperCase(),
              ) ?? null,
            selected: null,
            ready: false,
            product: guessed.type
              ? {
                  type: 'TIRE',
                  brand: { name: guessed.brandName },
                  tire: {
                    tire: {
                      width: guessed.width,
                      aspectRatio: guessed.aspectRatio,
                      rimDiameter: guessed.rimDiameter,
                      construction: guessed.construction,
                    },
                  },
                }
              : undefined,
          };
        }),
      );
      await this.matchInterpretedProducts(version);
      if (this.destroyed || version !== this.version) return;
      this.alerts.showWarningList('Revise la compra interpretada', [
        `${preview.lines.length} líneas preparadas; todavía no se guardaron registros.`,
        ...(preview.providerMatch
          ? []
          : ['No se encontró el proveedor. Confirme los datos del nuevo.']),
        ...this.warnings(),
      ]);
    } catch (error) {
      if (!this.destroyed && version === this.version)
        this.alerts.showError(
          this.errorMessage(
            error,
            'No se pudo interpretar la factura. Compruebe el JSON o use la modalidad manual.',
          ),
        );
    } finally {
      if (!this.destroyed && version === this.version)
        this.interpreting.set(false);
    }
  }
  async searchProviders(term: string): Promise<void> {
    if (this.locked()) return;
    this.providerLoading.set(true);
    try {
      const values = await firstValueFrom(
        this.providers.getProviders(1, 20, term),
      );
      this.cdr?.markForCheck();
      if (!this.destroyed)
        this.providerOptions.set(
          values.data.map((provider) => ({
            id: provider.id,
            name: provider.name,
          })),
        );
    } catch {
      if (!this.destroyed)
        this.alerts.showError('No se pudieron consultar proveedores.');
    } finally {
      if (!this.destroyed) this.providerLoading.set(false);
    }
  }
  chooseProvider(value: ValueParams | null): void {
    if (this.locked()) return;
    this.touch('provider');
    this.selectedProvider.set(value);
    this.requestId = crypto.randomUUID();
  }
  async matchProvider(): Promise<void> {
    if (this.locked() || this.providerForm.invalid) return;
    this.providerLoading.set(true);
    try {
      const raw = this.providerForm.getRawValue();
      const value = await firstValueFrom(
        this.service.matchProvider(raw.nrc, raw.nit),
      );
      this.cdr?.markForCheck();
      if (this.destroyed) return;
      if (value) {
        this.providerMode.set('existing');
        this.selectedProvider.set({ id: value.id, name: value.name });
        this.alerts.showSuccess('Proveedor registrado encontrado.');
      } else
        this.alerts.showWarning(
          'No se encontró el proveedor; permanecerá como borrador hasta guardar.',
        );
    } catch (error) {
      if (!this.destroyed)
        this.alerts.showError(
          this.errorMessage(error, 'Revise los identificadores del proveedor.'),
        );
    } finally {
      if (!this.destroyed) this.providerLoading.set(false);
    }
  }
  addRow(): void {
    if (this.locked() || this.mode() === 'DOCUMENT') return;
    this.rows.update((rows) => [
      ...rows,
      {
        key: crypto.randomUUID(),
        description: '',
        quantity: 1,
        unitPrice: '',
        choice: 'existing',
        type: '',
        brandName: '',
        brandMode: 'existing',
        brandSelected: null,
        selected: null,
        ready: false,
      },
    ]);
    this.markChanged();
  }
  removeRow(key: string): void {
    if (this.locked() || this.mode() === 'DOCUMENT') return;
    this.rows.update((rows) => rows.filter((row) => row.key !== key));
    this.markChanged();
  }
  changeProductType(row: PurchaseRowDraft, value: unknown): void {
    if (this.locked()) return;
    const next = value === 'TIRE' || value === 'SUPPLY' ? value : '';
    if (next === row.type) return;
    row.type = next;
    row.product = undefined;
    row.prepared = false;
    row.draftCatalog = undefined;
    row.draftVehicleTypes = undefined;
    row.productOptions = [];
    row.productVersion = (row.productVersion ?? 0) + 1;
    row.productLoading = false;
    if (this.matchRow()?.key === row.key) this.closeMatches();
    this.changeRow(row);
  }
  changeRow(row: PurchaseRowDraft): void {
    this.touch('products');
    row.ready = false;
    row.productId = undefined;
    row.selected = null;
    this.markChanged();
  }
  async searchProducts(row: PurchaseRowDraft, term: string): Promise<void> {
    if (this.locked() || !row.type) return;
    row.productLoading = true;
    const version = (row.productVersion ?? 0) + 1; row.productVersion = version;
    this.rows.update(rows => [...rows]);
    try {
      const result = await firstValueFrom(
        this.products.getProducts(row.type, 1, 30, { filter: term }),
      );
      this.cdr?.markForCheck();
      if (!this.destroyed && version === row.productVersion) row.productOptions = result.data.map(product => ({ id: product.id, name: product.name }));
    } catch {
      if (!this.destroyed)
        this.alerts.showError('No se pudieron consultar productos.');
    } finally {
      if (!this.destroyed && version === row.productVersion) { row.productLoading = false; this.rows.update(rows => [...rows]); }
    }
  }
  chooseProduct(row: PurchaseRowDraft, selected: ValueParams | null): void {
    if (this.locked()) return;
    row.productId = selected?.id;
    row.selected = selected;
    row.product = undefined;
    row.ready = !!selected;
    if (this.mode() === 'MANUAL') row.description = selected?.name ?? '';
    this.markChanged();
  }
  prepare(row: PurchaseRowDraft): void {
    if (this.locked()) return;
    row.validationAttempted = true;
    this.rows.update((rows) => [...rows]);
    if (
      !(row.brandMode === 'new' ? row.brandName.trim() : row.brandSelected) ||
      !row.type
    ) {
      this.alerts.showWarning(
        'Confirme el tipo y la marca antes de completar el producto.',
      );
      return;
    }
    this.editingKey = row.key;
    if (row.type === 'TIRE')
      this.tireModal()?.openForDraft(
        { ...row.product?.tire, purchasePrice: row.unitPrice },
        row.brandName.trim(),
      );
    else
      this.supplyModal()?.openForDraft(
        {
          ...row.product?.supply,
          name: row.product?.supply?.name ?? row.description,
          purchasePrice: row.unitPrice,
        },
        row.brandName.trim(),
      );
  }
  private preparedPrice(value: unknown): string | undefined {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
  }
  tirePrepared(payload: Partial<ProductTirePayload>): void {
    const row = this.rows().find((row) => row.key === this.editingKey);
    if (!row) return;
    row.draftCatalog = { unit: this.tireModal()?.selectedUnitOfMeasure() ?? undefined, item: this.tireModal()?.selectedItemType() ?? undefined };
    const vehicleTypes = this.tireModal()?.vehicleTypesQuery.data() ?? [];
    row.draftVehicleTypes = vehicleTypes.filter(type => payload.tire?.vehicleTypeId?.includes(type.id))
      .map(type => ({ vehicleTypeId: type.id, vehicleType: { ...type } }));
    const body = { ...payload, salePrice: this.preparedPrice(payload.salePrice), purchasePrice: this.preparedPrice(payload.purchasePrice) };
    delete body.brandId;
    delete body.providerId;
    row.product = { type: 'TIRE', ...this.brandPayload(row), tire: body };
    if (this.mode() === 'MANUAL' && payload.purchasePrice != null) row.unitPrice = String(payload.purchasePrice);
    row.ready = true;
    row.prepared = true;
    this.markChanged();
  }
  supplyPrepared(payload: Partial<Product>): void {
    const row = this.rows().find((row) => row.key === this.editingKey);
    if (!row) return;
    row.draftCatalog = { unit: this.supplyModal()?.selectedUnitOfMeasure() ?? undefined, item: this.supplyModal()?.selectedItemType() ?? undefined };
    row.product = {
      type: 'SUPPLY',
      ...this.brandPayload(row),
      supply: {
        name: payload.name,
        notes: payload.notes,
        salePrice: this.preparedPrice(payload.salePrice),
        purchasePrice: this.preparedPrice(payload.purchasePrice),
        taxType: payload.taxType,
        itemTypeCatalogId: payload.itemTypeCatalogId,
        unitOfMeasureCatalogId: payload.unitOfMeasureCatalogId,
      },
    };
    if (this.mode() === 'MANUAL' && payload.purchasePrice != null) row.unitPrice = String(payload.purchasePrice);
    row.ready = true;
    row.prepared = true;
    this.markChanged();
  }
  async searchBrands(row: PurchaseRowDraft, term: string): Promise<void> {
    if (this.locked()) return;
    row.brandLoading = true;
    this.rows.update((rows) => [...rows]);
    try {
      const values = await firstValueFrom(this.brands.getBrandByName(30, term));
      this.cdr?.markForCheck();
      if (!this.destroyed) row.brandOptions = values;
    } catch {
      if (!this.destroyed)
        this.alerts.showError('No se pudieron consultar marcas.');
    } finally {
      if (!this.destroyed) {
        row.brandLoading = false;
        this.rows.update((rows) => [...rows]);
      }
    }
  }
  chooseBrand(row: PurchaseRowDraft, value: ValueParams | null): void {
    if (this.locked()) return;
    row.brandSelected = value;
    row.brandName = value?.name ?? '';
    row.ready = false;
    this.markChanged();
  }
  switchBrandMode(row: PurchaseRowDraft, mode: 'existing' | 'new'): void {
    if (this.locked() || row.brandMode === mode) return;
    row.brandMode = mode;
    row.brandSelected = null;
    row.brandName = '';
    row.ready = false;
    this.markChanged();
  }
  brandSuggestions(row: PurchaseRowDraft): string[] {
    const names = new Map<string, string>();
    for (const candidate of this.rows()) {
      if (candidate.key === row.key || candidate.choice !== 'new' || candidate.brandMode !== 'new') continue;
      const name = candidate.brandName.trim().replace(/\s+/g, ' ');
      if (name) names.set(name.toUpperCase(), name.toUpperCase());
    }
    return [...names.values()];
  }
  private brandPayload(
    row: PurchaseRowDraft,
  ): { brandId: number } | { brand: { name: string } } {
    return row.brandMode === 'new'
      ? { brand: { name: row.brandName.trim().replace(/\s+/g, ' ').toUpperCase() } }
      : { brandId: row.brandSelected?.id ?? 0 };
  }
  async searchWarehouses(term: string): Promise<void> {
    if (this.locked()) return;
    try {
      const result = await firstValueFrom(
        this.warehouses.getWarehouses(1, 30, term),
      );
      this.cdr?.markForCheck();
      if (!this.destroyed)
        this.warehouseOptions.set(
          result.data.map((warehouse) => ({
            id: warehouse.id,
            name: warehouse.name,
          })),
        );
    } catch {
      if (!this.destroyed)
        this.alerts.showError('No se pudieron consultar bodegas.');
    }
  }
  readonly pdfViewer = viewChild(PdfPreviewComponent);
  private previewRequest = 0;
  async previewFile(kind: 'PDF' | 'JSON'): Promise<void> {
    const file = kind === 'PDF' ? this.pdf() : this.json();
    if (!file) return;
    this.revokePreview();
    const request = this.previewRequest;
    if (kind === 'JSON') {
      try {
        this.previewText.set(
          JSON.stringify(JSON.parse(await file.text()), null, 2),
        );
      } catch {
        this.previewText.set('El archivo no contiene JSON válido.');
      }
    } else {
      let header: string;
      try {
        header = await file.slice(0, 5).text();
      } catch {
        if (!this.destroyed && request === this.previewRequest) this.alerts.showError('No se pudo leer el PDF. Seleccione el archivo nuevamente.');
        return;
      }
      if (this.destroyed || request !== this.previewRequest) return;
      if (header !== '%PDF-') {
        this.alerts.showError('El archivo seleccionado no es un PDF válido. Revise el documento.');
        return;
      }
      await this.pdfViewer()?.open(file, 'Factura de compra');
      return;
    }
    if (!this.destroyed) this.previewDialog()?.nativeElement.showModal();
  }
  private revokePreview(): void {
    this.previewRequest++;
    this.previewText.set('');
  }
  closePreview(): void {
    this.previewDialog()?.nativeElement.close();
    this.revokePreview();
  }
  async save(): Promise<void> {
    if (this.savedOrderId() !== null) return;
    if (
      this.busy() ||
      this.interpreting() ||
      this.readOnly() ||
      (this.isEditing() && !this.hasEditChanges())
    )
      return;
    if (!this.uncertain() && this.duplicateProducts().length && !await this.resolveDuplicateProducts()) return;
    this.attempted.set(true);
    this.providerForm.markAllAsTouched();
    if (
      !this.uncertain() &&
      (!this.providerComplete() ||
        !this.productsValid() ||
        (this.mode() === 'DOCUMENT' && !this.sourceReady()) ||
        (!!this.pdf() && !this.pdfConfirmed()))
    ) {
      this.scrollToFeedback();
      this.alerts.showWarningList('La compra está incompleta', [
        ...(!this.providerComplete()
          ? ['Seleccione o complete el proveedor.']
          : []),
        ...(this.mode() === 'DOCUMENT' && !this.sourceReady()
          ? ['Interprete una factura JSON.']
          : []),
        ...(this.pdf() && !this.pdfConfirmed()
          ? ['Confirme que PDF y JSON corresponden a la misma factura.']
          : []),
        ...this.warnings(),
        ...(!this.rows().length ? ['Agregue al menos un producto.'] : []),
      ]);
      return;
    }
    const previous = this.submitted;
    const payload: AssistedPurchasePayload =
      previous && this.uncertain()
        ? previous.payload
        : {
            requestId: this.requestId,
            mode: this.mode(),
            pdfConfirmed: this.pdfConfirmed(),

            ...(this.mode() === 'DOCUMENT' ? { source: 'JSON' } : {}),
            ...(this.providerMode() === 'existing'
              ? { providerId: this.selectedProvider()?.id }
              : {
                  provider: {
                    ...this.providerForm.getRawValue(),
                    phone:
                      this.providerForm.controls.phone.value.trim() ||
                      undefined,
                    email:
                      this.providerForm.controls.email.value.trim() ||
                      undefined,
                  },
                }),
            details: this.payloadDetails(),
          };
    const files =
      previous && this.uncertain()
        ? previous.files
        : [this.pdf(), this.json()].filter(
            (file): file is File => file !== null,
          );
    this.submitted = { payload, files };
    this.busy.set(true);
    try {
      const orderId = this.editingOrder()?.id;
      const result = await firstValueFrom(
        orderId
          ? this.service.update(orderId, payload)
          : this.service.save(payload, files),
      );
      this.cdr?.markForCheck();
      if (this.destroyed) return;
      this.reset();
      invalidateCatalogCaches(this.queries);
      void this.queries.invalidateQueries({ queryKey: ['purchase-orders'] });
      this.alerts.showSuccess(
        orderId
          ? `Compra #${result.documentNumber} actualizada.`
          : `Compra #${result.documentNumber} guardada. El stock se incorpora al aprobar el ingreso.`,
      );
      this.savedOrderId.set(result.id);
      this.approvalChoice()?.nativeElement.showModal();
    } catch (error) {
      if (this.destroyed) return;
      const unknown =
        error instanceof HttpErrorResponse &&
        (error.status === 0 ||
          error.status >= 500 ||
          (error.status === 409 &&
            this.errorMessage(error, '').includes('proceso')));
      this.uncertain.set(unknown);
      if (!unknown) {
        this.submitted = null;
        this.requestId = crypto.randomUUID();
      }
      this.alerts.showError(
        unknown
          ? 'No se pudo confirmar el resultado. Reintente el mismo guardado para comprobarlo sin duplicar la compra.'
          : this.errorMessage(
              error,
              'No se guardó la compra. Revise los datos e intente nuevamente.',
            ),
      );
    } finally {
      if (!this.destroyed) this.busy.set(false);
    }
  }
  private errorMessage(error: unknown, fallback: string): string {
    if (
      error instanceof HttpErrorResponse &&
      error.error &&
      typeof error.error === 'object' &&
      'message' in error.error
    ) {
      const message: unknown = error.error.message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message))
        return message
          .filter((item): item is string => typeof item === 'string')
          .join('\n');
    }
    return fallback;
  }
}
