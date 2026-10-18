import { Component, input, signal } from '@angular/core';

import { Brand } from '../../interfaces/brand.interface';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-quick-view',
  imports: [DatePipe],
  templateUrl: './quick-view.component.html',
})
export class QuickViewComponent {

  brand = input<Brand>()

  isCopy = signal<boolean>(false)

copyText(text: string) {
  this.isCopy.set(true)
  navigator.clipboard.writeText(text);
  setTimeout(() => {
    this.isCopy.set(false)
  }, 2000);
}
}
