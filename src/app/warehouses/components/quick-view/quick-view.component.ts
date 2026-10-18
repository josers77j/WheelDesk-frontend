import { Component, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { Warehouse } from '../../interfaces/warehouse.interface';

@Component({
  selector: 'app-quick-view',
  imports: [DatePipe],
  templateUrl: './quick-view.component.html',
})
export class QuickViewComponent {
  warehouse = input<Warehouse>();

  isCopy = signal<boolean>(false);

  copyText(text: string) {
    this.isCopy.set(true);
    navigator.clipboard.writeText(text);
    setTimeout(() => {
      this.isCopy.set(false);
    }, 2000);
  }
}