import { Injectable, signal } from '@angular/core';

export type DeleteModalStateType = 'idle' | 'confirming' | 'loading' | 'finished'
@Injectable({
  providedIn: 'root'
})
export class DeleteActionModalService {
  //TODO: rename state to deleteModalState
  state = signal<DeleteModalStateType>('idle');
}
