import { fakeAsync, tick, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { CustomerService } from '../../../customers/services/customer.service';
import { CheckoutDocumentType } from '../../../sale-orders/interfaces/checkout.interface';
import { QuotationService } from '../../services/quotation.service';
import { QuotationDetail } from '../../interfaces/quotation.interface';
import { QuotationsPageComponent } from './quotations-page.component';

const quotation: QuotationDetail = { id: 1, documentNumber: 'COT-1', customerId: null, customerName: 'Cliente guardado', customerAddress: null, customer: null, saleType: CheckoutDocumentType.INVOICE, subtotal: '10', globalDiscount: '0', iva: '0', total: '10', notes: 'Notas guardadas', createdAt: '2026-10-19T12:00:00Z', details: [{id: 1, productId: 1, productName: 'Producto guardado', quantity: 1, unitPrice: '10', subtotal: '10', discountAmount: '0', amountAfterDiscount: '10', taxAmount: '0'}] };

describe('Quotation preview modal', (): void => {
 it('loads details on demand and closes through the backdrop without leaving the list', fakeAsync((): void => {
  const getQuotation = jasmine.createSpy('getQuotation').and.returnValue(of(quotation));
  TestBed.configureTestingModule({ imports: [QuotationsPageComponent], providers: [
   provideRouter([]), provideTanStackQuery(new QueryClient({defaultOptions: {queries: {retry: false}}})),
   {provide: CustomerService, useValue: {}},
   {provide: QuotationService, useValue: {getQuotation, getQuotations: () => of({data: [quotation], meta: {total: 1, totalPages: 1}})}},
  ] });
  const fixture = TestBed.createComponent(QuotationsPageComponent);
  fixture.detectChanges(); tick(); fixture.detectChanges();
  expect(getQuotation).not.toHaveBeenCalled();
  fixture.componentInstance.selectedId.set(1); fixture.detectChanges();
  const element: HTMLElement = fixture.nativeElement;
  const view = element.querySelector<HTMLButtonElement>('button[aria-label="Vista Previa"]');
  expect(view).not.toBeNull(); view?.click(); fixture.detectChanges(); tick(); fixture.detectChanges();
  expect(getQuotation).toHaveBeenCalledOnceWith(1);
  const dialog = element.querySelector<HTMLDialogElement>('dialog[aria-label="Vista previa de cotización"]');
  expect(dialog?.open).toBeTrue();
  expect(element.querySelector('app-quotation-preview')?.textContent).toContain('Producto guardado');
  dialog?.querySelector<HTMLButtonElement>('.modal-backdrop button')?.click(); fixture.detectChanges();
  expect(dialog?.open).toBeFalse();
  expect(fixture.componentInstance.previewId()).toBeNull();
  fixture.destroy();
 }));
});
