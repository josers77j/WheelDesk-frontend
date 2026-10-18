import { Component, ElementRef, HostListener, input, output, signal } from '@angular/core';

import { RouterLink } from '@angular/router';
import { DeleteActionModalComponent } from '../delete-action-modal/delete-action-modal.component';
import { PRODUCT_TYPE } from '../../../products/interfaces/product-type.enum';

@Component({
  selector: 'app-fab-selector',
  imports: [RouterLink, DeleteActionModalComponent],
  templateUrl: './fab-selector.component.html',
})
export class FabSelectorComponent {
  constructor(private readonly elementRef: ElementRef) {}

  idForSelector = input.required<number>();
  redirectTo = input.required<string>();
  productType = input<PRODUCT_TYPE>();
  useModal = input<boolean>(false);

  editClick = output<number>();

  isOpen = signal<boolean>(false);
  // Cerrar cuando haces click fuera
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  onModify() {
    this.isOpen.set(false);
    this.editClick.emit(this.idForSelector());
  }
}
