import { Injectable, signal } from '@angular/core';

export type ModalStateType = 'idle' | 'confirming' | 'loading' | 'finished'

export const MODAL_STATE_TYPE = {
  IDLE: 'idle',
  CONFIRMING: 'confirming',
  LOADING: 'loading',
  FINISHED: 'finished'
} as const
@Injectable({
  providedIn: 'root'
})
export class ActionModalService {
  modalState = signal<ModalStateType>('idle');
  model = signal<string>('');
}
