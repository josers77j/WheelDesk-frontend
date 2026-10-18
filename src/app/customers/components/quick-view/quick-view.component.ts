import { Component, input, signal } from '@angular/core';


import { PhoneFormatPipe } from '../../../shared/pipes/phone-format.pipe';
import { Customer } from '../../interfaces/customer.interface';


@Component({
  selector: 'app-quick-view',
  imports: [PhoneFormatPipe],
  templateUrl: './quick-view.component.html',
})
export class QuickViewComponent {

  customer = input<Customer>()

  isCopy = signal<boolean>(false)
copyText(text: string) {
  this.isCopy.set(true)
  navigator.clipboard.writeText(text);
  setTimeout(() => {
    this.isCopy.set(false)
  }, 2000);
}

}
