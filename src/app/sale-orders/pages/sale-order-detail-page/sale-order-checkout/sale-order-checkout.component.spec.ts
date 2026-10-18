import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of, Subject } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CheckoutDocumentType, type CheckoutPayload } from '../../../interfaces/checkout.interface';
import { CustomerService } from '../../../../customers/services/customer.service';
import { ProductService } from '../../../../products/services/product.service';
import { PRODUCT_TYPE } from '../../../../products/interfaces/product-type.enum';
import { QuotationService } from '../../../../quotations/services/quotation.service';
import { AlertService } from '../../../../shared/components/alert/alert.service';
import { DeleteActionModalService } from '../../../../shared/components/delete-action-modal/deleteActionModal.service';
import { WarehouseService } from '../../../../warehouses/services/warehouse.service';
import { ZoneService } from '../../../../zones/services/zone.service';
import { DiscountType } from '../../../interfaces/checkout.interface';
import { CatalogService } from '../../../services/catalog.service';
import { CheckoutDraftService } from '../../../services/checkout-draft.service';
import { SaleOrderService } from '../../../services/sale-order.service';
import { SaleOrderCheckoutComponent } from './sale-order-checkout.component';

type ProductResult = ReturnType<ProductService['getProductById']> extends import('rxjs').Observable<infer T> ? T : never;
describe('Checkout quotation item regressions', (): void => {
  let component: SaleOrderCheckoutComponent;
  let requests: Map<number, Subject<ProductResult>>;
  let alerts: { showError: jasmine.Spy };
  beforeEach((): void => {
    requests = new Map([[1, new Subject<ProductResult>()], [2, new Subject<ProductResult>()]]);
    alerts = { showError: jasmine.createSpy('showError') };
    TestBed.configureTestingModule({ providers: [
      provideTanStackQuery(new QueryClient({ defaultOptions: { queries: { retry: false } } })),
      { provide: Location, useValue: {} }, { provide: Router, useValue: {} }, { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map() } } },
      { provide: QuotationService, useValue: {} }, { provide: SaleOrderService, useValue: {} },
      { provide: CatalogService, useValue: { getCatalog: (): ReturnType<CatalogService['getCatalog']> => of([]) } },
      { provide: CustomerService, useValue: {} }, { provide: ZoneService, useValue: {} }, { provide: WarehouseService, useValue: {} },
      DeleteActionModalService, { provide: AlertService, useValue: alerts },
      { provide: ProductService, useValue: { getProductById: (id: number): Subject<ProductResult> => { const request = requests.get(id); if (!request) throw new Error('Unexpected product'); return request; } } },
    ] });
    component = TestBed.runInInjectionContext(() => new SaleOrderCheckoutComponent(TestBed.inject(Location)));
    const fb = TestBed.inject(FormBuilder);
    for (const id of [1, 2]) component.itemsArray.push(fb.group({ productId: id, name: `Item ${id}`, quantity: 2, zoneId: null, zoneName: '', unitPrice: 17, unitPriceEstimate: '99', discountType: DiscountType.USD, discountValue: 3 }));
  });
  it('keeps the sidebar product status pending until every sale line has a zone', (): void => {
    expect(component.reviewItems().find(item => item.label === 'Productos y cantidades')?.complete).toBeFalse();
    for (const control of component.itemsArray.controls) control.get('zoneId')?.setValue(3);
    expect(component.reviewItems().find(item => item.label === 'Productos y cantidades')?.complete).toBeTrue();
  });
  it('clears previous metadata and preserves quoted price and discount when editing another item', (): void => {
    component.selectedWarehouse.set({ id: 5, name: 'Old warehouse' });
    component.selectedProductType.set(PRODUCT_TYPE.SERVICE);
    component.selectedIndexItem.set(1); component.onModifyItem();
    expect(component.selectedWarehouse()).toBeNull(); expect(component.productStock()).toBeNull();
    expect(component.selectedProductType()).toBeNull(); expect(component.selectedZone()).toBeNull();
    expect(component.itemForm.getRawValue().unitPrice).toBe(17);
    expect(component.itemForm.getRawValue().discountValue).toBe(3);
    expect(component.selectedIndexItem()).toBe(1); expect(component.selectedProduct()?.id).toBe(2);
  });
  it('ignores a failed metadata request from an item that is no longer selected', async (): Promise<void> => {
    component.selectedIndexItem.set(0); component.onModifyItem();
    component.selectedIndexItem.set(1); component.onModifyItem();
    component.priceEstimate.set('Manual estimate');
    requests.get(1)?.error(new Error('Old request failed'));
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(component.priceEstimate()).toBe('Manual estimate');
  });
  for (const field of ['product', 'warehouse', 'zone', 'quantity', 'price'] as const) {
    it(`explains the missing or invalid ${field} when saving a sale item`, (): void => {
      component.selectedProduct.set({ id: 1, name: 'Item 1' });
      component.selectedWarehouse.set({ id: 2, name: 'Bodega' });
      component.itemForm.patchValue({ productId: 1, zoneId: 3, quantity: 1, unitPrice: null });
      const expected = {
        product: 'Selecciona un producto.',
        warehouse: 'Selecciona una bodega y después la zona de salida del producto.',
        zone: 'Selecciona la zona de salida del producto.',
        quantity: 'Indica una cantidad mayor o igual a 1.',
        price: 'El precio de venta no puede ser negativo.',
      };
      if (field === 'product') component.itemForm.controls.productId.setValue(0);
      if (field === 'warehouse') { component.selectedWarehouse.set(null); component.itemForm.controls.zoneId.setValue(null); }
      if (field === 'zone') component.itemForm.controls.zoneId.setValue(null);
      if (field === 'quantity') component.itemForm.controls.quantity.setValue(0);
      if (field === 'price') component.itemForm.controls.unitPrice.setValue(-1);
      const count = component.itemsArray.length;
      component.onSaveItem();
      expect(alerts.showError).toHaveBeenCalledWith(expected[field]);
      expect(component.itemsArray.length).toBe(count);
      expect(component.itemForm.touched).toBeTrue();
    });
  }

  it('updates the location guidance after selecting the warehouse and zone', (): void => {
    component.itemForm.controls.productId.setValue(1);
    component.selectedProduct.set({ id: 1, name: 'Item 1' });
    component.onSaveItem();
    expect(component.needsItemWarehouse()).toBeTrue();
    component.setWarehouse({ id: 2, name: 'Bodega' });
    expect(component.needsItemWarehouse()).toBeFalse();
    expect(component.itemValidationMessages()).toEqual(['Selecciona la zona de salida del producto.']);
    component.setItemZone({ id: 3, name: 'Zona' });
    expect(component.itemValidationMessages()).toEqual([]);
  });

  it('keeps a saved zone valid without forcing warehouse reselection or an optional sale price', (): void => {
    component.selectedProduct.set({ id: 1, name: 'Item 1' });
    component.selectedZone.set({ id: 3, name: 'Zona' });
    component.itemForm.patchValue({ productId: 1, quantity: 1, zoneId: 3, unitPrice: null });
    const count = component.itemsArray.length;
    component.onSaveItem();
    expect(component.itemsArray.length).toBe(count + 1);
    expect(alerts.showError).not.toHaveBeenCalled();
  });

  it('explains an empty checkout and a missing payment', async (): Promise<void> => {
    component.itemsArray.clear();
    await component.onSubmit();
    expect(alerts.showError).toHaveBeenCalledWith('Debe agregar al menos un producto');
    const fb = TestBed.inject(FormBuilder);
    component.itemsArray.push(fb.group({ productId: 1, quantity: 1, zoneId: 3 }));
    await component.onSubmit();
    expect(alerts.showError).toHaveBeenCalledWith('Debe agregar al menos un pago');
  });

  it('explains incomplete payments before returning from an invalid checkout', async (): Promise<void> => {
    for (const control of component.itemsArray.controls) control.get('zoneId')?.setValue(3);
    component.onAddPayment();
    component.paymentsArray.at(0).patchValue({ paymentMethodId: null, amount: 0 });
    await component.onSubmit();
    expect(alerts.showError).toHaveBeenCalledWith('Revisa los pagos: cada uno debe tener un método de pago y un monto mayor que cero.');
  });

  it('explains the missing tax credit customer before the generic invalid-form guard', async (): Promise<void> => {
    for (const control of component.itemsArray.controls) control.get('zoneId')?.setValue(3);
    component.onAddPayment();
    component.paymentsArray.at(0).patchValue({ paymentMethodId: 1, amount: Math.max(1, Number(component.totalEstimate())) });
    component.checkoutForm.controls.customerId.setValidators(Validators.required);
    component.checkoutForm.controls.customerId.updateValueAndValidity();
    spyOn(component, 'isTaxCredit').and.returnValue(true);
    await component.onSubmit();
    expect(alerts.showError).toHaveBeenCalledWith('El crédito fiscal requiere un cliente');
  });

  it('requires zones before opening sale confirmation', async (): Promise<void> => {
    await component.onSubmit();
    expect(alerts.showError).toHaveBeenCalledWith('Selecciona una zona para cada producto antes de confirmar la venta');
  });
  it('does not initialize a destroyed checkout after quotation loading finishes', async (): Promise<void> => {
    const pending = new Subject<import('../../../../quotations/interfaces/quotation.interface').QuotationDetail>();
    const route = TestBed.inject(ActivatedRoute);
    spyOn(route.snapshot.queryParamMap, 'get').and.returnValue('1');
    const quoteService = TestBed.inject(QuotationService);
    Object.assign(quoteService, { getQuotation: (): typeof pending => pending });
    const router = TestBed.inject(Router);
    Object.assign(router, { navigate: jasmine.createSpy('navigate').and.resolveTo(true) });
    const seed = spyOn(TestBed.inject(CheckoutDraftService), 'seedFromQuotation');
    const subscribe = spyOn(component.checkoutForm.valueChanges, 'subscribe').and.callThrough();
    const init = component.ngOnInit();
    component.ngOnDestroy();
    pending.next({ id:1, documentNumber:'Q1', customerName:null, customerAddress:null, customer:null, customerId:null, saleType:null, subtotal:'0', iva:'0', globalDiscount:'0', total:'0', notes:null, createdAt:'2026-10-06', details:[] });
    await init;
    expect(pending.observed).toBeFalse();
    expect(seed).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  function selectAttachments(files: File[]): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    const data = new DataTransfer();
    for (const file of files) data.items.add(file);
    input.files = data.files;
    input.addEventListener('change', (event): void => component.onAttachmentsSelected(event));
    input.dispatchEvent(new Event('change'));
  }

  for (const firstFormat of ['pdf', 'json']) {
    it(`accepts ${firstFormat} first and keeps it when the other format is attached later`, (): void => {
      const pdf = new File(['%PDF-1.7'], 'original.pdf', { type: 'application/pdf' });
      const json = new File(['{}'], 'original.json', { type: 'application/json' });
      const first = firstFormat === 'pdf' ? pdf : json;
      const second = firstFormat === 'pdf' ? json : pdf;
      selectAttachments([first]);
      expect(component.attachmentFiles()).toEqual([first]);
      expect(alerts.showError).not.toHaveBeenCalled();
      expect(component.reviewItems().find(item => item.label === 'Documentos originales (opcionales)')?.complete).toBeFalse();
      selectAttachments([second]);
      expect(component.attachmentFiles()).toContain(pdf);
      expect(component.attachmentFiles()).toContain(json);
      expect(component.attachmentFiles().length).toBe(2);
      expect(component.reviewItems().find(item => item.label === 'Documentos originales (opcionales)')?.complete).toBeTrue();
      expect(JSON.stringify(TestBed.inject(CheckoutDraftService).draft())).not.toContain('original.pdf');
    });
  }

  it('accepts a pair in one selection and preserves it on an invalid selection or cancellation', (): void => {
    const pdf = new File(['pdf'], 'original.pdf');
    const json = new File(['{}'], 'original.json');
    selectAttachments([pdf, json]);
    expect(component.attachmentFiles()).toEqual([pdf, json]);
    selectAttachments([new File(['text'], 'invalid.txt')]);
    expect(component.attachmentFiles()).toEqual([pdf, json]);
    selectAttachments([]);
    expect(component.attachmentFiles()).toEqual([pdf, json]);
    selectAttachments([new File(['pdf'], 'first.pdf'), new File(['pdf'], 'second.pdf')]);
    expect(component.attachmentFiles()).toEqual([pdf, json]);
    expect(alerts.showError).toHaveBeenCalledTimes(2);
  });

  it('replaces one format without removing the other', (): void => {
    const json = new File(['{}'], 'original.json');
    const updated = new File(['pdf'], 'updated.PDF');
    selectAttachments([new File(['pdf'], 'original.pdf'), json]);
    selectAttachments([updated]);
    expect(component.attachmentFiles().length).toBe(2);
    expect(component.attachmentFiles()).toContain(json);
    expect(component.attachmentFiles()).toContain(updated);
  });

  it('accepts dropped documents progressively and locks drops while saving', (): void => {
    const pdf = new File(['%PDF-1.7'], 'original.pdf');
    const json = new File(['{}'], 'original.json');
    const drop = (file: File): void => {
      const data = new DataTransfer();
      data.items.add(file);
      const event = new DragEvent('drop', { dataTransfer: data, cancelable: true });
      component.draggingAttachments.set(true);
      component.onAttachmentsDropped(event);
      expect(event.defaultPrevented).toBeTrue();
      expect(component.draggingAttachments()).toBeFalse();
    };
    drop(pdf);
    drop(json);
    expect(component.attachmentFiles()).toEqual([pdf, json]);
    component.isLoading.set(true);
    drop(new File(['pdf'], 'replacement.pdf'));
    expect(component.attachmentFiles()).toEqual([pdf, json]);
    component.isLoading.set(false);
    component.savedSaleId.set(42);
    drop(new File(['{}'], 'replacement.json'));
    expect(component.attachmentFiles()).toEqual([pdf, json]);
  });

  it('formats JSON for preview and explains invalid JSON', async (): Promise<void> => {
    await component.previewAttachment(new File(['{"total":25}'], 'original.json'));
    expect(component.attachmentPreviewText()).toBe('{\n  "total": 25\n}');
    component.closeAttachmentPreview();
    expect(component.attachmentPreviewText()).toBe('');
    await component.previewAttachment(new File(['invalid'], 'original.json'));
    expect(component.attachmentPreviewText()).toBe('El archivo no contiene JSON válido.');
  });

  it('does not restore a JSON preview after its document was removed', async (): Promise<void> => {
    const file = new File(['{}'], 'original.json');
    component.attachmentFiles.set([file]);
    const preview = component.previewAttachment(file);
    component.removeAttachment(file);
    await preview;
    expect(component.attachmentPreviewText()).toBe('');
  });

  it('removes individual attachments and allows continuing without documents', (): void => {
    const pdf = new File(['pdf'], 'original.pdf');
    const json = new File(['{}'], 'original.json');
    selectAttachments([pdf, json]);
    component.removeAttachment(pdf);
    expect(component.attachmentFiles()).toEqual([json]);
    expect(component.attachmentsComplete()).toBeFalse();
    component.removeAttachment(json);
    expect(component.attachmentFiles()).toEqual([]);
  });

  it('locks attachment changes while saving and after the sale is saved', (): void => {
    const pdf = new File(['pdf'], 'original.pdf');
    const json = new File(['{}'], 'original.json');
    selectAttachments([pdf]);
    component.isLoading.set(true);
    selectAttachments([json]);
    component.removeAttachment(pdf);
    expect(component.attachmentFiles()).toEqual([pdf]);
    component.isLoading.set(false);
    component.savedSaleId.set(42);
    selectAttachments([json]);
    component.removeAttachment(pdf);
    expect(component.attachmentFiles()).toEqual([pdf]);
  });

  for (const format of ['pdf', 'json']) {
    it(`blocks saving a sale with only its ${format}, before making any request`, async (): Promise<void> => {
      const file = new File(['test'], 'original.' + format);
      component.attachmentFiles.set([file]);
      const submit = jasmine.createSpy('checkout');
      Object.assign(TestBed.inject(SaleOrderService), { checkout: submit });
      await component.onSubmit();
      expect(submit).not.toHaveBeenCalled();
      expect(alerts.showError).toHaveBeenCalledWith('Adjunta un PDF y un JSON antes de guardar, o quita los documentos para continuar sin adjuntos.');
      expect(component.attachmentFiles()).toEqual([file]);
    });
  }

  it('rechecks attachments when confirming a sale', (): void => {
    component.attachmentFiles.set([new File(['{}'], 'original.json')]);
    const submit = jasmine.createSpy('checkout');
    Object.assign(TestBed.inject(SaleOrderService), { checkout: submit });
    component.onInvoiceConfirmed();
    expect(submit).not.toHaveBeenCalled();
    expect(alerts.showError).toHaveBeenCalledWith('Adjunta un PDF y un JSON antes de guardar, o quita los documentos para continuar sin adjuntos.');
  });

  it('retries email for the saved sale without invoking checkout again', (): void => {
    const sendEmail = jasmine.createSpy('sendEmail').and.returnValue(of({ emailStatus: 'sent', message: 'Enviado' }));
    const checkout = jasmine.createSpy('checkout');
    Object.assign(TestBed.inject(SaleOrderService), { sendEmail, checkout });
    Object.assign(TestBed.inject(AlertService), { showSuccess: jasmine.createSpy('showSuccess') });
    Object.assign(TestBed.inject(Router), { navigate: jasmine.createSpy('navigate').and.resolveTo(true) });
    component.savedSaleId.set(42);
    component.retryEmail();
    expect(sendEmail).toHaveBeenCalledOnceWith(42);
    expect(checkout).not.toHaveBeenCalled();
    expect(component.emailRetrying()).toBeFalse();
  });
  it('warns and preserves the saved sale when the final checkout response reports email failure', async (): Promise<void> => {
    const response = { requestId: 'saved-request', saleOrderId: 42, status: 'COMPLETED', finalized: true, message: 'Venta creada', emailStatus: 'failed' };
    const checkout = jasmine.createSpy('checkout').and.returnValue(of(response));
    const warning = jasmine.createSpy('showWarning');
    const navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    Object.assign(TestBed.inject(SaleOrderService), { checkout });
    Object.assign(TestBed.inject(AlertService), { showWarning: warning });
    Object.assign(TestBed.inject(Router), { navigate });
    await component.mutationCheckout.mutateAsync({ requestId: 'saved-request', documentType: CheckoutDocumentType.INVOICE, documentTypeId: 1, items: [], paymentMethod: [] });
    expect(component.savedSaleId()).toBe(42);
    expect(warning).toHaveBeenCalledWith('Se generó la venta, pero el email no pudo ser enviado. Intenta nuevamente o llama a soporte');
    expect(navigate).not.toHaveBeenCalled();
    expect(checkout).toHaveBeenCalledTimes(1);
  });
  it('does not submit another sale after email delivery failed', async (): Promise<void> => {
    component.savedSaleId.set(42);
    const touched = spyOn(component.checkoutForm, 'markAllAsTouched');
    await component.onSubmit();
    expect(touched).not.toHaveBeenCalled();
  });

  it('keeps the draft removed after a completed sale with failed email even when stale form events fire', async (): Promise<void> => {
    const checkout = jasmine.createSpy('checkout').and.returnValue(of({ requestId: 'saved-request', saleOrderId: 42, status: 'COMPLETED', finalized: true, message: 'Venta creada', emailStatus: 'failed' }));
    Object.assign(TestBed.inject(SaleOrderService), { checkout });
    Object.assign(TestBed.inject(AlertService), { showWarning: jasmine.createSpy('showWarning') });
    Object.assign(TestBed.inject(Router), { navigate: jasmine.createSpy('navigate').and.resolveTo(true) });
    await component.ngOnInit();
    await component.mutationCheckout.mutateAsync({ requestId: 'saved-request', documentType: CheckoutDocumentType.INVOICE, documentTypeId: 1, items: [], paymentMethod: [] });
    component.checkoutForm.patchValue({ customerId: 123 });
    component.onDeletePayment(0);
    expect(component.checkoutForm.disabled).toBeTrue();
    expect(TestBed.inject(CheckoutDraftService).draft().items).toEqual([]);
    expect(localStorage.getItem('workshop.sale-order.draft')).toBeNull();
    await component.onSubmit();
    expect(checkout).toHaveBeenCalledTimes(1);
    component.ngOnDestroy();
  });

});


describe('Internal checkout HTTP contract', (): void => {
  let service: SaleOrderService;
  let http: HttpTestingController;
  const payload: CheckoutPayload = { requestId: 'request-id', documentType: CheckoutDocumentType.INVOICE, documentTypeId: 1, items: [], paymentMethod: [] };
  beforeEach((): void => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), SaleOrderService] });
    service = TestBed.inject(SaleOrderService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach((): void => http.verify());
  it('keeps JSON for a sale with no attachments and consumes its final response', (): void => {
    service.checkout(payload).subscribe((result): void => { expect(result.finalized).toBeTrue(); expect(result.emailStatus).toBe('not_requested'); });
    const request = http.expectOne((req) => req.url.endsWith('/sale-orders/checkout'));
    expect(request.request.body).toEqual(payload);
    request.flush({ requestId: 'request-id', saleOrderId: 42, status: 'COMPLETED', finalized: true, message: 'Venta creada', emailStatus: 'not_requested' });
  });
  it('sends original files in multipart with a JSON payload field', (): void => {
    const files = [new File(['pdf'], 'original.pdf'), new File(['{}'], 'original.json')];
    service.checkout(payload, files).subscribe();
    const request = http.expectOne((req) => req.url.endsWith('/sale-orders/checkout'));
    const body: unknown = request.request.body;
    expect(body instanceof FormData).toBeTrue();
    if (!(body instanceof FormData)) throw new Error('Expected multipart');
    expect(body.get('payload')).toBe(JSON.stringify(payload));
    expect(body.getAll('files')).toEqual(files);
    request.flush({ requestId: 'request-id', saleOrderId: 42, status: 'COMPLETED', finalized: true, message: 'Venta creada', emailStatus: 'failed' });
  });
});
