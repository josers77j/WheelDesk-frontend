import { TestBed } from '@angular/core/testing';
import { ConfirmActionModalComponent } from './confirm-action-modal.component';

describe('Confirmation modal backdrop', (): void => {
  it('cancels without confirming when the user clicks outside', (): void => {
    const fixture=TestBed.createComponent(ConfirmActionModalComponent);fixture.detectChanges();
    const cancelled=jasmine.createSpy('cancelled'),confirmed=jasmine.createSpy('confirmed');
    fixture.componentInstance.cancelled.subscribe(cancelled);fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.componentInstance.open();
    const dialog: HTMLDialogElement=fixture.nativeElement.querySelector('dialog');
    const backdrop: HTMLButtonElement=fixture.nativeElement.querySelector('.modal-backdrop button');
    backdrop.click();expect(dialog.open).toBeFalse();expect(cancelled).toHaveBeenCalledTimes(1);expect(confirmed).not.toHaveBeenCalled();
  });
});
