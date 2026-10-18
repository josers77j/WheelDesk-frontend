import { TestBed } from '@angular/core/testing';
import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { of, Subject } from 'rxjs';
import { PurchaseDocumentsModalComponent } from './purchase-documents-modal.component';
import { PurchaseDocumentsService } from '../../services/purchase-documents.service';
import { AlertService } from '../../../shared/components/alert/alert.service';

describe('Purchase originals modal', () => {
  const api = { status: jasmine.createSpy('status'), file: jasmine.createSpy('file'), zip: jasmine.createSpy('zip'), email: jasmine.createSpy('email') };
  const alerts = { showError: jasmine.createSpy('error'), showSuccess: jasmine.createSpy('success') };
  beforeEach(() => {
    Object.values(api).forEach(spy => spy.calls.reset());
    api.status.and.returnValue(of({ pdf: 'signed', json: 'signed' }));
    api.file.and.returnValue(of(new HttpResponse({ body: new Blob(['{}']), headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename="original.json"' }) })));
    api.email.and.returnValue(of({}));
    TestBed.configureTestingModule({ imports: [PurchaseDocumentsModalComponent], providers: [{ provide: PurchaseDocumentsService, useValue: api }, { provide: AlertService, useValue: alerts }] });
    TestBed.overrideComponent(PurchaseDocumentsModalComponent, { set: { template: '', imports: [] } });
  });
  it('does not request documents until opened and keeps bulk selection local', () => {
    const component = TestBed.createComponent(PurchaseDocumentsModalComponent).componentInstance;
    component.openZip([1, 2]);
    expect(api.status).not.toHaveBeenCalled();
    expect(api.file).not.toHaveBeenCalled();
    expect(component.formats()).toEqual(['pdf', 'json']);
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
