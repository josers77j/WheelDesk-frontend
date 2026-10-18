import { Component, effect, ElementRef, inject, ViewChild } from '@angular/core';
import { DeleteActionModalService } from './deleteActionModal.service';

@Component({
  selector: 'app-delete-action-modal',
  imports: [],
  templateUrl: './delete-action-modal.component.html',
})
export class DeleteActionModalComponent {
  deleteModalService = inject(DeleteActionModalService)

  @ViewChild('deleteDialog') deleteDialog!: ElementRef<HTMLDialogElement>

  onModalConfirmed() {
    this.deleteModalService.state.set('confirming');
  }

  closeModalEffect = effect(() => {
    if (this.deleteModalService.state() === 'finished') {
      this.resetModal()
    }
  });

  resetModal() {
    this.deleteModalService.state.set('idle')
      this.deleteDialog?.nativeElement?.close();
  }



}
