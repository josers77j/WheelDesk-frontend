import { Component, ElementRef, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-confirm-action-modal',
  imports: [],
  templateUrl: './confirm-action-modal.component.html',
})
export class ConfirmActionModalComponent {
  private readonly dialog =
    viewChild<ElementRef<HTMLDialogElement>>('confirmDialog');

  title = input<string>('Confirmar');
  message = input<string>('¿Está seguro?');
  confirmLabel = input<string>('Confirmar');
  cancelLabel = input<string>('Cancelar');

  confirmed = output<void>();
  cancelled = output<void>();

  open() {
    this.dialog()?.nativeElement?.showModal();
  }

  onConfirm() {
    this.dialog()?.nativeElement?.close();
    this.confirmed.emit();
  }

  onCancel() {
    this.dialog()?.nativeElement?.close();
    this.cancelled.emit();
  }
}
