import { Component, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { Transfer } from '../../interfaces/transfer.interface';
import { TransferStatusPipe } from '../../pipes/transfer-status.pipe';

@Component({
  selector: 'app-quick-view',
  imports: [DatePipe, TransferStatusPipe],
  templateUrl: './quick-view.component.html',
})
export class QuickViewComponent {
  transfer = input<Transfer>();

  isCopy = signal<boolean>(false);

  copyText(text: string) {
    this.isCopy.set(true);
    navigator.clipboard.writeText(text);
    setTimeout(() => {
      this.isCopy.set(false);
    }, 2000);
  }
}