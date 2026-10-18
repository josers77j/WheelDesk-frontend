import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertComponent } from './alert.component';
import { AlertService } from './alert.service';

@Component({ imports: [AlertComponent], template: '@if (showFirst) { <app-alert /> } <app-alert />' })
class AlertHostsComponent {
  showFirst = true;
}

describe('Alert host ownership', (): void => {
  let fixture: ComponentFixture<AlertHostsComponent>;
  let service: AlertService;
  const visibleAlerts = (): NodeListOf<HTMLElement> => {
    const root: HTMLElement = fixture.nativeElement;
    return root.querySelectorAll('[role="alert"]');
  };
  beforeEach((): void => {
    TestBed.configureTestingModule({ imports: [AlertHostsComponent] });
    service = TestBed.inject(AlertService);
    fixture = TestBed.createComponent(AlertHostsComponent);
  });
  it('renders each queued notification once when layout and page both have hosts', (): void => {
    fixture.detectChanges();
    service.showError('Los pagos no cubren el total estimado');
    service.showSuccess('Factura en proceso');
    fixture.detectChanges();
    expect(visibleAlerts().length).toBe(2);
    expect(Array.from(visibleAlerts()).filter((alert) => alert.textContent?.includes('Los pagos')).length).toBe(1);
  });
  it('transfers pending notifications to the remaining host after navigation', (): void => {
    fixture.detectChanges();
    service.showSuccess('Factura en proceso');
    fixture.detectChanges();
    expect(visibleAlerts().length).toBe(1);
    fixture.componentInstance.showFirst = false;
    fixture.detectChanges();
    expect(visibleAlerts().length).toBe(1);
    expect(visibleAlerts()[0].textContent).toContain('Factura en proceso');
  });
  it('retains alerts emitted before a host is mounted', (): void => {
    service.showError('Completa los campos obligatorios');
    fixture.detectChanges();
    expect(visibleAlerts().length).toBe(1);
    expect(service.alerts().length).toBe(1);
  });
  it('places success and error alerts above an open native modal', async (): Promise<void> => {
    fixture.detectChanges();
    const dialog = document.createElement('dialog');
    document.body.appendChild(dialog);
    dialog.showModal();
    try {
      service.showSuccess('Guardado'); service.showError('No se pudo guardar');
      fixture.detectChanges();
      const overlay = dialog.querySelector<HTMLElement>('[popover="manual"]');
      expect(overlay).not.toBeNull();
      expect(overlay?.matches(':popover-open')).toBeTrue();
      expect(overlay?.querySelectorAll('[role="alert"]').length).toBe(2);
      dialog.close();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(dialog.querySelector('[popover="manual"]')).toBeNull();
    } finally { dialog.close(); dialog.remove(); }
  });
  it('renders a warning with the yellow warning style', (): void => {
    fixture.detectChanges();
    service.showWarning('Venta creada, correo no enviado');
    fixture.detectChanges();
    expect(visibleAlerts().length).toBe(1);
    expect(visibleAlerts()[0].classList.contains('alert-warning')).toBeTrue();
  });

});
