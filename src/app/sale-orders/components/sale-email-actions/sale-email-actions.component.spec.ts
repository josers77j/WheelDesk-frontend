import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { SaleEmailActionsComponent } from './sale-email-actions.component';
import { SaleOrderService } from '../../services/sale-order.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { AlertService } from '../../../shared/components/alert/alert.service';

describe('SaleEmailActionsComponent', () => {
  const sales = jasmine.createSpyObj('SaleOrderService', ['sendEmail']);
  const customers = jasmine.createSpyObj('CustomerService', ['getCustomerById']);
  const alerts = jasmine.createSpyObj('AlertService', ['showSuccess', 'showWarning', 'showError']);

  beforeEach(async () => {
    sales.sendEmail.calls.reset(); customers.getCustomerById.calls.reset();
    alerts.showSuccess.calls.reset(); alerts.showWarning.calls.reset(); alerts.showError.calls.reset();
    sales.sendEmail.and.returnValue(of({ emailStatus: 'sent', message: 'ok' }));
    customers.getCustomerById.and.returnValue(of({ email: 'cliente@example.com' }));
    await TestBed.configureTestingModule({ imports: [SaleEmailActionsComponent], providers: [
      { provide: SaleOrderService, useValue: sales }, { provide: CustomerService, useValue: customers },
      { provide: AlertService, useValue: alerts },
    ] }).compileComponents();
  });

  function create(customerId: number | null = null) {
    const fixture = TestBed.createComponent(SaleEmailActionsComponent);
    fixture.componentRef.setInput('order', { id: 42, customerId, document: { pdfKey: 'p', jsonKey: 'j' } });
    fixture.detectChanges();
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    spyOn(dialog, 'showModal'); spyOn(dialog, 'close');
    return { fixture, component: fixture.componentInstance, dialog };
  }

  it('renders only the dialog so its trigger can live outside the modal tree', (): void => {
    const { fixture, dialog } = create();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.firstElementChild).toBe(dialog);
    expect(element.querySelector('[aria-label="Reenviar documentos por correo"]')).toBeNull();
  });

  it('uses manual recipient without querying when there is no customer', async () => {
    const { component } = create(); await component.open();
    expect(component.recipient()).toBe('manual');
    expect(component.pdf()).toBeTrue(); expect(component.json()).toBeTrue();
    expect(customers.getCustomerById).not.toHaveBeenCalled();
  });

  it('defaults to the registered customer email', async () => {
    const { component } = create(7); await component.open();
    expect(component.recipient()).toBe('client');
    expect(component.clientEmail()).toBe('cliente@example.com');
  });

  it('sends only the selected PDF to the alternate email', async () => {
    const { component, dialog } = create(); await component.open();
    component.email.set(' otro@example.com '); component.json.set(false);
    await component.send();
    expect(sales.sendEmail).toHaveBeenCalledOnceWith(42, { recipient: 'manual', attachments: ['pdf'], email: 'otro@example.com' });
    expect(dialog.close).toHaveBeenCalled();
  });

  it('does not send without an attachment', async () => {
    const { component } = create(); await component.open();
    component.pdf.set(false); component.json.set(false); await component.send();
    expect(sales.sendEmail).not.toHaveBeenCalled();
  });

  it('keeps the modal open on a delivery failure', async () => {
    sales.sendEmail.and.returnValue(of({ emailStatus: 'failed', message: 'Intenta nuevamente' }));
    const { component, dialog } = create(); await component.open(); component.email.set('otro@example.com');
    await component.send();
    expect(dialog.close).not.toHaveBeenCalled();
    expect(alerts.showWarning).toHaveBeenCalledWith('Intenta nuevamente');
    expect(component.busy()).toBeFalse();
  });

  it('ignores a customer response after closing the modal', async () => {
    const response = new Subject<{ email: string }>();
    customers.getCustomerById.and.returnValue(response);
    const { component } = create(7); const opening = component.open(); component.close();
    response.next({ email: 'tarde@example.com' }); await opening;
    expect(component.clientEmail()).toBe(''); expect(component.loading()).toBeFalse();
  });
});
