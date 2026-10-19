import { ProductEntryLayoutComponent } from '../../../shared/components/product-entry-layout/product-entry-layout.component';
import { ReviewChecklistComponent, ReviewItem } from '../../../shared/components/review-checklist/review-checklist.component';
import { CurrencyPipe } from '@angular/common';
import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { debounceTime, firstValueFrom } from 'rxjs';
import { CustomerService } from '../../../customers/services/customer.service';
import { Customer } from '../../../customers/interfaces/customer.interface';
import { customerMissingFields } from '../../../customers/utils/customer-missing-fields.util';
import { CustomerFormModalComponent } from '../../../customers/components/customer-form-modal/customer-form-modal.component';
import { ProductService } from '../../../products/services/product.service';
import { ComboboxFormControlComponent } from '../../../shared/components/combobox-form-control/combobox-form-control.component';
import { ValueParams } from '../../../shared/components/combobox/interfaces/search-param.interface';
import { ConfirmActionModalComponent } from '../../../shared/components/confirm-action-modal/confirm-action-modal.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { QueryErrorComponent } from '../../../shared/components/query-error/query-error.component';
import { CheckoutDocumentType, DiscountType } from '../../../sale-orders/interfaces/checkout.interface';
import { QuotationLineInput, QuotationWrite } from '../../interfaces/quotation.interface';
import { QuotationService } from '../../services/quotation.service';

@Component({ selector: 'app-quotation-form-page', imports: [ProductEntryLayoutComponent, ReviewChecklistComponent, CurrencyPipe, RouterLink, ReactiveFormsModule, ComboboxFormControlComponent, CustomerFormModalComponent, ConfirmActionModalComponent, AlertComponent, QueryErrorComponent], templateUrl: './quotation-form-page.component.html' })
export class QuotationFormPageComponent implements OnInit {
 private readonly route = inject(ActivatedRoute); private readonly router = inject(Router); private readonly service = inject(QuotationService); private readonly customers = inject(CustomerService); private readonly products = inject(ProductService); private readonly alerts = inject(AlertService); private readonly cache = inject(QueryClient); private readonly fb = inject(FormBuilder);
 readonly id = Number(this.route.snapshot.paramMap.get('id') ?? 0);
 readonly editing = this.route.snapshot.routeConfig?.path?.startsWith('edit') ?? false;
 readonly loading = signal(this.editing); readonly loadFailed = signal(false); readonly saving = signal(false); readonly customerLoading = signal(false);
 readonly mode = signal<'EXISTING' | 'NEW'>('EXISTING');
 readonly customerValue = signal<ValueParams | null>(null); readonly customer = signal<Customer | null>(null);
 readonly customerSearch = signal(''); readonly productSearch = signal(''); readonly customerTouched = signal(false); readonly productTouched = signal(false);
 readonly selectedProduct = signal<ValueParams | null>(null); readonly editingLine = signal<number | null>(null);
 readonly lines = signal<QuotationLineInput[]>([]);
 readonly discountTypes = DiscountType;
 readonly missingFields = customerMissingFields;
 readonly customerModal = viewChild(CustomerFormModalComponent); readonly confirmation = viewChild(ConfirmActionModalComponent); readonly itemDialog = viewChild<ElementRef<HTMLDialogElement>>('itemDialog');
 readonly header = this.fb.nonNullable.group({ saleType: CheckoutDocumentType.INVOICE, customerName: '', customerAddress: '', notes: '', discountType: this.fb.control<DiscountType | null>(null), discountValue: this.fb.control<number | null>(null, Validators.min(0)) });
 readonly headerValues = toSignal(this.header.valueChanges, { initialValue: this.header.getRawValue() });
 readonly itemForm = this.fb.group({ quantity: [1, [Validators.required, Validators.min(1)]], unitPrice: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]), discountType: this.fb.control<DiscountType | null>(null), discountValue: this.fb.control<number | null>(null, Validators.min(0)) });
 readonly payload = computed((): QuotationWrite => {
  const h = this.headerValues();
  return { customerId: this.customerValue()?.id ?? null, customerName: h.customerName?.trim() || null, customerAddress: h.customerAddress?.trim() || null, notes: h.notes?.trim() || null, saleType: h.saleType ?? CheckoutDocumentType.INVOICE, discountType: h.discountType ?? DiscountType.USD, discountValue: h.discountValue ?? 0, details: this.lines() };
 });
 private readonly moneyPayload = computed((): QuotationWrite => ({ ...this.payload(), customerId: null, customerName: null, customerAddress: null, notes: null }));
 private readonly previewInput = toSignal(toObservable(this.moneyPayload).pipe(debounceTime(300)), { initialValue: this.moneyPayload() });
 readonly preview = injectQuery(() => ({ queryKey: ['quotation-preview', this.previewInput()], queryFn: () => firstValueFrom(this.service.preview(this.previewInput())), enabled: this.previewInput().details.length > 0 && !this.loading(), retry: false, staleTime: 300000 }));
 readonly attemptedSave = signal(false);
 readonly reviewItems = computed((): ReviewItem[] => {
  const header = this.headerValues();
  return [
   { label: 'Productos y cantidades', complete: this.lines().length > 0, touched: this.attemptedSave() },
   { label: 'Importes calculados', complete: this.previewReady(), touched: this.attemptedSave() },
   { label: 'Cliente (opcional)', complete: this.customerResolved() && (!!this.customerValue() || !!header.customerName?.trim()), touched: false, optional: true },
   { label: 'Observaciones (opcional)', complete: !!header.notes?.trim(), touched: false, optional: true },
  ];
 });
 private customerRequest = 0;
 readonly customerResolved = computed(() => this.customerValue() === null || (this.customer() !== null && this.customer()?.id === this.customerValue()?.id));
 readonly previewReady = computed(() => this.previewCurrent() && this.preview.isSuccess() && !this.preview.isFetching());
 readonly previewCurrent = computed(() => JSON.stringify(this.moneyPayload()) === JSON.stringify(this.previewInput()));
 readonly canSave = computed(() => !this.loading() && !this.loadFailed() && !this.saving() && !this.customerLoading() && this.lines().length > 0 && this.customerResolved() && this.previewReady());
 readonly customerQuery = injectQuery(() => ({ queryKey: ['quotation-form-customers', this.customerSearch()], queryFn: () => firstValueFrom(this.customers.getCustomers(1, 10, this.customerSearch())), enabled: this.customerTouched() && this.mode() === 'EXISTING', staleTime: 300000 }));
 readonly customerOptions = computed(() => (this.customerQuery.data()?.data ?? []).map((c): ValueParams => ({ id: c.id, name: c.name })));
 readonly productQuery = injectQuery(() => ({ queryKey: ['quotation-products', this.productSearch()], queryFn: () => firstValueFrom(this.products.getSummaryByName(this.productSearch())), enabled: this.productTouched(), staleTime: 300000 }));
 async ngOnInit(): Promise<void> {
  if (!this.editing) return;
  if (!Number.isSafeInteger(this.id) || this.id < 1) { this.loadFailed.set(true); this.loading.set(false); return; }
  try {
   const quote = await firstValueFrom(this.service.getQuotation(this.id));
   this.header.patchValue({ saleType: quote.saleType ?? CheckoutDocumentType.INVOICE, customerName: quote.customerName ?? quote.customer?.name ?? '', customerAddress: quote.customerAddress ?? '', notes: quote.notes ?? '', discountType: DiscountType.USD, discountValue: Number(quote.globalDiscount) });
   this.lines.set(quote.details.map((line): QuotationLineInput => ({ productId: line.productId, productName: line.productName, quantity: line.quantity, unitPrice: Number(line.unitPrice), discountType: DiscountType.USD, discountValue: Number(line.discountAmount) })));
   if (quote.customerId) { this.mode.set('EXISTING'); this.customerValue.set({ id: quote.customerId, name: quote.customer?.name ?? quote.customerName ?? '' }); this.customer.set(await firstValueFrom(this.customers.getCustomerById(quote.customerId))); }
  } catch { this.loadFailed.set(true); this.alerts.showError('No se pudo cargar la cotización para editar'); }
  finally { this.loading.set(false); }
 }
 setMode(mode: 'EXISTING' | 'NEW'): void {
  if (mode === this.mode()) return;
  this.customerRequest++;
  this.customerLoading.set(false);
  this.mode.set(mode); this.customerValue.set(null); this.customer.set(null);
  this.header.patchValue({ customerName: '', customerAddress: '' });
 }
 async chooseCustomer(value: ValueParams | null): Promise<void> {
  const request = ++this.customerRequest;
  this.customerValue.set(value); this.customer.set(null); this.header.patchValue({ customerName: '', customerAddress: '' });
  this.customerLoading.set(value !== null);
  if (!value) return;
  try {
   const customer = await firstValueFrom(this.customers.getCustomerById(value.id));
   if (request === this.customerRequest) this.customerSaved(customer);
  } catch {
   if (request === this.customerRequest) { this.customerValue.set(null); this.alerts.showError('No se pudo cargar el cliente'); }
  } finally { if (request === this.customerRequest) this.customerLoading.set(false); }
 }
 customerSaved(customer: Customer): void { this.customer.set(customer); this.customerValue.set({ id: customer.id, name: customer.name }); this.header.patchValue({ customerName: customer.name, customerAddress: customer.address ?? '' }); this.cache.setQueryData(['customer', customer.id], customer); }
 createCustomer(): void { this.customerModal()?.openForCreate(false); }
 editCustomer(): void { const customer = this.customer(); if (customer) this.customerModal()?.openForEdit(customer, false); }
 openItem(index: number | null = null): void {
  this.editingLine.set(index); const line = index === null ? undefined : this.lines()[index];
  this.selectedProduct.set(line ? { id: line.productId, name: line.productName } : null);
  this.itemForm.reset({ quantity: line?.quantity ?? 1, unitPrice: line?.unitPrice ?? null, discountType: line?.discountType ?? null, discountValue: line?.discountValue ?? null });
  this.itemDialog()?.nativeElement.showModal();
 }
 addItem(): void {
  this.itemForm.markAllAsTouched(); const product = this.selectedProduct(); const value = this.itemForm.getRawValue(); const index = this.editingLine();
  if (!product || this.itemForm.invalid || value.quantity === null || !Number.isSafeInteger(value.quantity) || value.unitPrice === null || !Number.isFinite(value.unitPrice)) { this.alerts.showError('Selecciona un producto, cantidad entera y precio válido'); return; }
  if ((value.discountType === null) !== (value.discountValue === null) || (value.discountType === DiscountType.PERCENT && (value.discountValue ?? 0) > 100)) { this.alerts.showError('Completa el tipo y valor de descuento; el porcentaje no puede superar 100%'); return; }
  if (this.lines().some((line, i) => line.productId === product.id && i !== index)) { this.alerts.showError('El producto ya está agregado'); return; }
  const line: QuotationLineInput = { productId: product.id, productName: product.name, quantity: value.quantity, unitPrice: value.unitPrice, ...(value.discountType !== null && value.discountValue !== null ? { discountType: value.discountType, discountValue: value.discountValue } : {}) };
  this.lines.update((lines) => index === null ? [...lines, line] : lines.map((previous, i) => i === index ? line : previous)); this.itemDialog()?.nativeElement.close();
 }
 removeItem(index: number): void { this.lines.update((lines) => lines.filter((_, i) => i !== index)); }
 requestSave(): void {
  this.attemptedSave.set(true);
  this.header.markAllAsTouched();
  const h = this.header.getRawValue();
  if ((h.discountType === null) !== (h.discountValue === null)) { this.alerts.showError('Completa el tipo y valor del descuento global'); return; }
  if (this.header.invalid || !this.canSave()) return;
  this.confirmation()?.open();
 }
 async save(): Promise<void> {
  if (!this.canSave()) return; this.saving.set(true);
  try { const payload = this.payload(); const result = await firstValueFrom(this.editing ? this.service.update(this.id, payload) : this.service.create(payload)); await this.cache.invalidateQueries({ queryKey: ['quotations'] }); await this.cache.invalidateQueries({ queryKey: ['quotation', result.id] }); this.alerts.showSuccess(this.editing ? 'Cotización actualizada' : 'Cotización creada'); await this.router.navigate(['/quotations/detail', result.id]); }
  catch { this.alerts.showError('No se pudo guardar la cotización. Revisa los datos e intenta nuevamente.'); }
  finally { this.saving.set(false); }
 }
}
