import { Component, effect, ElementRef, inject, input, viewChild } from '@angular/core';
import { ActionModalService, MODAL_STATE_TYPE } from './actionModal.service';

@Component({
  selector: 'app-action-modal',
  imports: [],
  templateUrl: './action-modal.component.html',
})

export class ActionModalComponent {
  actionModalService = inject(ActionModalService)


  titleAction = input<string>();
  actionModal = viewChild<ElementRef<HTMLDialogElement>>('actionModal')

  onModalConfirmed() {
    this.actionModalService.modalState.set(this.modalStateType.CONFIRMING);
    this.actionModalService.model.set(this.titleAction() ?? '');
  }

  closeModalEffect = effect(() => {
    if (this.actionModalService.modalState() === this.modalStateType.FINISHED) {
      this.resetModal()
    }

  });

  resetModal() {
    this.actionModalService.modalState.set(this.modalStateType.IDLE)
    this.actionModalService.model.set('');
    this.actionModal()?.nativeElement?.close();
  }

  modalStateType = MODAL_STATE_TYPE;



}
