import { TestBed } from '@angular/core/testing';
import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import { PurchaseDocumentsModalComponent } from './purchase-documents-modal.component';
import { PurchaseDocumentsService } from '../../services/purchase-documents.service';
import { AlertService } from '../../../shared/components/alert/alert.service';

describe('Purchase originals modal', () => {
  const api = { status: jasmine.createSpy('status'), file: jasmine.createSpy('file'), zip: jasmine.createSpy('zip'), email: jasmine.createSpy('email'), selection: jasmine.createSpy('selection'), emailSelection: jasmine.createSpy('emailSelection') };
  const alerts = { showError: jasmine.createSpy('error'), showSuccess: jasmine.createSpy('success') };
  beforeEach(() => {
    Object.values(api).forEach(spy => spy.calls.reset());
    api.status.and.returnValue(of({ pdf: 'signed', json: 'signed' }));
    api.file.and.returnValue(of(new HttpResponse({ body: new Blob(['{}']), headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename="original.json"' }) })));
    api.email.and.returnValue(of({}));
    api.emailSelection.and.returnValue(of({}));
    api.selection.and.callFake((ids: number[]) => of(ids.map(id => ({ id, documentNumber: id + 10, sourceIdentity: '123:code-' + id, provider: 'Proveedor ' + id, createdAt: '2026-10-01', pdf: true, json: true }))));
    TestBed.configureTestingModule({ imports: [PurchaseDocumentsModalComponent], providers: [{ provide: PurchaseDocumentsService, useValue: api }, { provide: AlertService, useValue: alerts }] });
    TestBed.overrideComponent(PurchaseDocumentsModalComponent, { set: { template: '', imports: [] } });
  });
  it('loads selected order metadata once and defers file downloads until preview', async () => {
    const component = TestBed.createComponent(PurchaseDocumentsModalComponent).componentInstance;
    expect(api.selection).not.toHaveBeenCalled();
    await component.openZip([1, 2]);
    expect(api.selection).toHaveBeenCalledOnceWith([1, 2]);
    expect(api.status).not.toHaveBeenCalled();
    expect(api.file).not.toHaveBeenCalled();
    expect(component.formats()).toEqual(['pdf', 'json']);
  });
  it('removes an order from the page selection and scopes preview cache by order', async (): Promise<void> => {
    const component = TestBed.createComponent(PurchaseDocumentsModalComponent).componentInstance;
    const changed = jasmine.createSpy('selectionChange');
    component.selectionChange.subscribe(changed);
    await component.openZip([1, 2]);
    await component.preview('json', 1);
    await component.preview('json', 1);
    await component.preview('json', 2);
    expect(api.file.calls.allArgs()).toEqual([[1, 'json'], [2, 'json']]);
    component.removePurchase(1);
    expect(component.ids()).toEqual([2]);
    expect(component.rows().map(row => row.id)).toEqual([2]);
    expect(changed).toHaveBeenCalledOnceWith([2]);
    component.removePurchase(2);
    await component.sendEmail();
    expect(component.formats()).toEqual([]);
    expect(api.emailSelection).not.toHaveBeenCalled();
  });
  it('requires a valid manual address and locks the reviewed selection during a bulk send', async (): Promise<void> => {
    const component = TestBed.createComponent(PurchaseDocumentsModalComponent).componentInstance;
    await component.openEmail([1, 2]);
    component.recipient.setValue('invalid');
    await component.sendEmail();
    expect(api.emailSelection).not.toHaveBeenCalled();
    const pending = new Subject<unknown>();
    api.emailSelection.and.returnValue(pending);
    component.recipient.setValue('  destino@example.com  ');
    component.select('pdf', false);
    const sending = component.sendEmail();
    component.removePurchase(1);
    await component.sendEmail();
    expect(component.ids()).toEqual([1, 2]);
    expect(api.emailSelection).toHaveBeenCalledOnceWith([1, 2], 'destino@example.com', ['json']);
    pending.next({}); pending.complete(); await sending;
  });
  it('marks unavailable purchases without silently dropping selected ids', async (): Promise<void> => {
    api.selection.and.returnValue(of([]));
    const component = TestBed.createComponent(PurchaseDocumentsModalComponent).componentInstance;
    await component.openZip([99]);
    expect(component.ids()).toEqual([99]);
    expect(component.rows()[0].provider).toBe('Compra no disponible');
    expect(component.formats()).toEqual([]);
    await component.preview('pdf', 99);
    expect(api.file).not.toHaveBeenCalled();
  });
  it('reuses a fetched original while previewing JSON repeatedly', async () => {
    const component = TestBed.createComponent(PurchaseDocumentsModalComponent).componentInstance;
    await component.open(1);
    await component.preview('json');
    await component.preview('json');
    expect(api.file).toHaveBeenCalledTimes(1);
    expect(component.jsonText()).toBe('{}');
  });
  it('requires a manually entered recipient and blocks duplicate sends', async () => {
    const component = TestBed.createComponent(PurchaseDocumentsModalComponent).componentInstance;
    await component.open(1);
    await component.sendEmail();
    expect(api.email).not.toHaveBeenCalled();
    const pending = new Subject<unknown>();
    api.email.and.returnValue(pending);
    component.recipient.setValue('destino@example.com');
    const sending = component.sendEmail();
    await component.sendEmail();
    expect(api.email).toHaveBeenCalledOnceWith(1, 'destino@example.com', ['pdf', 'json']);
    pending.next({}); pending.complete(); await sending;
    expect(component.busy()).toBe('');
  });
});
