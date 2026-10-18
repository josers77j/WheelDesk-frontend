import { TestBed } from '@angular/core/testing';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { NEVER } from 'rxjs';
import { SaleActivityModalComponent } from './sale-activity-modal.component';
import { AuthService } from '../../../auth/services/auth.service';
import { signal } from '@angular/core';
import { AuditService } from '../../../audit/services/audit.service';

describe('Sale activity requests', (): void => {
 it('does not request activity merely because a sale is selected',async (): Promise<void> => {
  const audit=jasmine.createSpyObj('AuditService',['getLogs']);audit.getLogs.and.returnValue(NEVER);
  const admin = signal(true);
  TestBed.configureTestingModule({imports:[SaleActivityModalComponent],providers:[provideTanStackQuery(new QueryClient()),{provide:AuditService,useValue:audit},{provide:AuthService,useValue:{isAdmin:admin}}]});
  const fixture=TestBed.createComponent(SaleActivityModalComponent);fixture.componentRef.setInput('orderId',1);fixture.detectChanges();
  await new Promise<void>(resolve=>setTimeout(resolve,20));
  expect(audit.getLogs).not.toHaveBeenCalled();
  fixture.componentInstance.open();fixture.detectChanges();
  await new Promise<void>(resolve=>setTimeout(resolve,20));
  expect(audit.getLogs.calls.count()).toBe(1);
  const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
  dialog.close();await new Promise<void>(resolve=>setTimeout(resolve,10));
  fixture.componentRef.setInput('orderId',2);fixture.detectChanges();
  await new Promise<void>(resolve=>setTimeout(resolve,20));
  expect(audit.getLogs.calls.count()).toBe(1);
 });
 it('does not fetch another sale while the native close event is pending', async (): Promise<void> => {
  const audit = jasmine.createSpyObj('AuditService', ['getLogs']); audit.getLogs.and.returnValue(NEVER);
  TestBed.configureTestingModule({imports: [SaleActivityModalComponent], providers: [provideTanStackQuery(new QueryClient()), {provide: AuditService, useValue: audit}, {provide: AuthService, useValue: {isAdmin: signal(true)}}]});
  const fixture = TestBed.createComponent(SaleActivityModalComponent);
  fixture.componentRef.setInput('orderId', 1); fixture.detectChanges();
  fixture.componentInstance.open(); fixture.detectChanges();
  await new Promise<void>(resolve => setTimeout(resolve, 20));
  expect(audit.getLogs.calls.count()).toBe(1);
  const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
  // Keep the reactive flag stale to reproduce the interval before native close delivery.
  dialog.addEventListener('close', (event: Event): void => event.stopImmediatePropagation(), {capture: true});
  dialog.close();
  fixture.componentRef.setInput('orderId', 2); fixture.detectChanges();
  await new Promise<void>(resolve => setTimeout(resolve, 20));
  expect(audit.getLogs.calls.count()).toBe(1);
 });
 it('does not fetch administrative audit when opened by a viewer', async (): Promise<void> => {
  const audit = jasmine.createSpyObj('AuditService', ['getLogs']); audit.getLogs.and.returnValue(NEVER);
  TestBed.configureTestingModule({ imports: [SaleActivityModalComponent], providers: [provideTanStackQuery(new QueryClient()), { provide: AuditService, useValue: audit }, { provide: AuthService, useValue: { isAdmin: signal(false) } }] });
  const fixture = TestBed.createComponent(SaleActivityModalComponent);
  fixture.componentRef.setInput('orderId', 1); fixture.detectChanges();
  fixture.componentInstance.open(); fixture.detectChanges();
  await new Promise<void>((resolve) => setTimeout(resolve, 20));
  expect(fixture.componentInstance.isOpen()).toBeFalse();
  expect(audit.getLogs).not.toHaveBeenCalled();
 });

});
