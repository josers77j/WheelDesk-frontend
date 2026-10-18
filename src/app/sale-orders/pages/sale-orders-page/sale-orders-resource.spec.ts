import { HttpResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { NEVER, of, Subject } from 'rxjs';
import { SaleOrdersPageComponent } from './sale-orders-page.component';
import { SaleOrderService } from '../../services/sale-order.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { AuthService } from '../../../auth/services/auth.service';
import type { User } from '../../../auth/interfaces/user.interface';

describe('Synchronous sale ZIP lifecycle', (): void => {
 let service: jasmine.SpyObj<SaleOrderService>;
 let pending: Subject<HttpResponse<Blob>>;
 beforeEach((): void => {
  pending = new Subject<HttpResponse<Blob>>();
  service = jasmine.createSpyObj('SaleOrderService', ['getSaleOrders', 'requestDocumentsZip', 'getDocuments'], { selectedSaleOrderId: signal(0) });
  service.getSaleOrders.and.returnValue(NEVER);
  service.requestDocumentsZip.and.returnValue(pending);
  const params = convertToParamMap({});
  TestBed.configureTestingModule({ imports: [SaleOrdersPageComponent], providers: [
   provideTanStackQuery(new QueryClient({defaultOptions:{queries:{retry:false}}})),
   {provide: ActivatedRoute,useValue:{snapshot:{queryParamMap:params},queryParamMap:of(params)}},
   {provide: Router,useValue:{navigate:jasmine.createSpy('navigate')}},
   {provide: SaleOrderService,useValue:service},
   {provide: AuthService,useValue:{isAdmin:signal(true),user:signal(null)}},
   {provide: AlertService,useValue:jasmine.createSpyObj('AlertService',['showError', 'showWarning'])},
  ]});
  TestBed.overrideComponent(SaleOrdersPageComponent,{set:{template:'',imports:[]}});
 });
 it('requests a PDF once while a sales preview lookup is pending', async (): Promise<void> => {
  service.getDocuments.and.returnValue(NEVER);
  const fixture = TestBed.createComponent(SaleOrdersPageComponent);
  service.selectedSaleOrderId.set(4);
  void fixture.componentInstance.previewInvoicePdf();
  void fixture.componentInstance.previewInvoicePdf();
  expect(service.getDocuments).toHaveBeenCalledOnceWith(4);
  expect(fixture.componentInstance.previewLoading()).toBeTrue();
  fixture.destroy();
 });
 it('previews the original JSON as formatted text without downloading it', async (): Promise<void> => {
  service.getDocuments.and.returnValue(of({pdf:null,json:{key:'original.json',url:'https://example.test/original.json'},cached:true,filename:'original'}));
  const fetchRequest = spyOn(window, 'fetch').and.resolveTo(new Response('{"total":25}'));
  const fixture = TestBed.createComponent(SaleOrdersPageComponent);
  TestBed.flushEffects();
  service.selectedSaleOrderId.set(4);
  await fixture.componentInstance.previewInvoiceJson();
  expect(fetchRequest.calls.count()).toBe(1);
  expect(fixture.componentInstance.jsonPreviewText()).toBe('{\n  "total": 25\n}');
  expect(fixture.componentInstance.previewLoading()).toBeFalse();
  fixture.componentInstance.closeJsonPreview();
  expect(fixture.componentInstance.jsonPreviewText()).toBe('');
  fixture.destroy();
 });
 it('explains an unreadable original JSON and releases the loading state', async (): Promise<void> => {
  service.getDocuments.and.returnValue(of({pdf:null,json:{key:'original.json',url:'https://example.test/original.json'},cached:true,filename:'original'}));
  spyOn(window, 'fetch').and.resolveTo(new Response('invalid'));
  const fixture = TestBed.createComponent(SaleOrdersPageComponent);
  TestBed.flushEffects();
  service.selectedSaleOrderId.set(4);
  await fixture.componentInstance.previewInvoiceJson();
  expect(fixture.componentInstance.jsonPreviewText()).toBe('');
  expect(fixture.componentInstance.previewLoading()).toBeFalse();
  expect(TestBed.inject(AlertService).showError).toHaveBeenCalledWith('No se pudo obtener o leer el JSON de esta venta. Intenta nuevamente.');
  fixture.destroy();
 });
 it('ignores a JSON response for a sale that is no longer selected', async (): Promise<void> => {
  const documents = new Subject<import('../../interfaces/sale-order.interface').SaleDocumentsResponse>();
  service.getDocuments.and.returnValue(documents);
  const fetchRequest = spyOn(window, 'fetch');
  const fixture = TestBed.createComponent(SaleOrdersPageComponent);
  TestBed.flushEffects();
  service.selectedSaleOrderId.set(4);
  const preview = fixture.componentInstance.previewInvoiceJson();
  void fixture.componentInstance.previewInvoicePdf();
  expect(service.getDocuments).toHaveBeenCalledOnceWith(4);
  service.selectedSaleOrderId.set(5);
  documents.next({pdf:null,json:{key:'original.json',url:'https://example.test/original.json'},cached:true,filename:'original'});
  await preview;
  expect(fetchRequest).not.toHaveBeenCalled();
  expect(fixture.componentInstance.jsonPreviewText()).toBe('');
  expect(fixture.componentInstance.previewLoading()).toBeFalse();
  fixture.destroy();
 });
 it('stops waiting when the JSON document lookup never responds', fakeAsync((): void => {
  service.getDocuments.and.returnValue(NEVER);
  const fixture = TestBed.createComponent(SaleOrdersPageComponent);
  TestBed.flushEffects();
  service.selectedSaleOrderId.set(4);
  void fixture.componentInstance.previewInvoiceJson();
  tick(30_001);
  expect(fixture.componentInstance.previewLoading()).toBeFalse();
  expect(TestBed.inject(AlertService).showError).toHaveBeenCalled();
  fixture.destroy();
 }));
 it('makes one request while downloading and never schedules polling', fakeAsync((): void => {
  const fixture=TestBed.createComponent(SaleOrdersPageComponent);
  fixture.componentInstance.appliedSearchParams.set({from:'2026-10-01',to:'2026-10-06'});
  fixture.componentInstance.downloadZip(); fixture.componentInstance.downloadZip(); tick(6000);
  expect(service.requestDocumentsZip).toHaveBeenCalledOnceWith('2026-10-01','2026-10-06');
  expect(fixture.componentInstance.zipDownloading()).toBeTrue();
  fixture.destroy();
 }));
 it('cancels the ZIP request when leaving and ignores a late result', (): void => {
  const fixture=TestBed.createComponent(SaleOrdersPageComponent);
  fixture.componentInstance.appliedSearchParams.set({from:'2026-10-01',to:'2026-10-06'});
  fixture.componentInstance.downloadZip();
  expect(pending.observed).toBeTrue(); fixture.destroy();
  expect(pending.observed).toBeFalse();
  pending.next(new HttpResponse({body:new Blob(['zip'])}));
  expect(service.requestDocumentsZip.calls.count()).toBe(1);
 });
 it('does not download without a complete date range', (): void => {
  const fixture=TestBed.createComponent(SaleOrdersPageComponent);
  fixture.componentInstance.appliedSearchParams.set({from:'2026-10-01'});
  fixture.componentInstance.downloadZip();
  expect(service.requestDocumentsZip).not.toHaveBeenCalled(); fixture.destroy();
 });
 it('keeps creation disabled for a viewer and permits a seller', (): void => {
  const admin = signal(false);
  const user = signal<User | null>({id: 1, name: 'QA', email: 'qa@example.test', role: 'VIEWER'});
  Object.assign(TestBed.inject(AuthService), {isAdmin: admin, user});
  const fixture = TestBed.createComponent(SaleOrdersPageComponent);
  expect(fixture.componentInstance.canCreateSale()).toBeFalse();
  user.set({id: 1, name: 'QA', email: 'qa@example.test', role: 'SELLER'});
  expect(fixture.componentInstance.canCreateSale()).toBeTrue();
  fixture.destroy();
 });

 it('does not download JSON when PDF is selected but the historical PDF is absent', async (): Promise<void> => {
  service.getDocuments.and.returnValue(of({pdf:null,json:{key:'invoice.json',url:'https://example.test/invoice.json'},cached:true,filename:'original'}));
  const fixture = TestBed.createComponent(SaleOrdersPageComponent);
  TestBed.flushEffects();
  service.selectedSaleOrderId.set(1);
  fixture.componentInstance.documentChoice.set('pdf');
  const fetchRequest = spyOn(window, 'fetch');
  fixture.componentInstance.confirmDocumentDownload();
  await Promise.resolve(); await Promise.resolve();
  expect(fetchRequest).not.toHaveBeenCalled();
  expect(TestBed.inject(AlertService).showWarning).toHaveBeenCalledWith('Esta venta no tiene PDF original adjunto');
  fixture.destroy();
 });

});
