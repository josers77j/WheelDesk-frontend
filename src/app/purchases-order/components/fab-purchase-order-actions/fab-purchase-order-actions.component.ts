import { Component, ElementRef, HostListener, input, signal, viewChild } from '@angular/core';

import { RouterLink } from '@angular/router';
import { ActionModalComponent } from "../action-modal/action-modal.component";

@Component({
  selector: 'app-fab-purchase-order-actions',
  imports: [RouterLink, ActionModalComponent],
  templateUrl: './fab-purchase-order-actions.component.html',
})
export class FabPurchaseOrderActionsComponent {
  constructor(private readonly elementRef: ElementRef) {}

  idSelected = input.required<number>();
  modalTitleAction = signal<string>('')
  isOpen = signal<boolean>(false)
  actionModal = viewChild<ElementRef<HTMLDialogElement>>('actionModal')

  onOpenModal(title: string){
    this.modalTitleAction.set(title);

  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false)
    }
  }
}
