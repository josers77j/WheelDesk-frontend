import { Component, input, signal } from '@angular/core';


import { DatePipe } from '@angular/common';
import { Provider } from '../../interfaces/provider.interface';


@Component({
  selector: 'app-quick-view',
  imports: [DatePipe],
  templateUrl: './quick-view.component.html',
})
export class QuickViewComponent {

  provider = input<Provider>()

  isCopy = signal<boolean>(false)

contactValue(field: string): string | null | undefined {
    const provider = this.provider();
    switch (field) {
      case 'nrc': return provider?.nrc;
      case 'nit': return provider?.nit;
      case 'phone': return provider?.phone;
      case 'email': return provider?.email;
      default: return null;
    }
  }

copyText(text: string) {
  this.isCopy.set(true)
  navigator.clipboard.writeText(text);
  setTimeout(() => {
    this.isCopy.set(false)
  }, 2000);
}
}
