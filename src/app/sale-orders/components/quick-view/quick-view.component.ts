import { Component, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { SaleOrder } from '../../interfaces/sale-order.interface';
import { SaleOrderStatusPipe } from '../../pipes/sale-order-status.pipe';
import { DteTypePipe } from '../../pipes/dte-type.pipe';
import { SALE_ORDER_STATUS } from '../../enums/sale-order-status.enum';

@Component({
  selector: 'app-sale-order-quick-view',
  imports: [DatePipe, CurrencyPipe, SaleOrderStatusPipe, DteTypePipe],
  templateUrl: './quick-view.component.html',
})
export class SaleOrderQuickViewComponent {
  order = input<SaleOrder>();


  orderStatus = SALE_ORDER_STATUS;
  isCopy = signal<boolean>(false);

  copyText(text: string): void {
    this.isCopy.set(true);
    navigator.clipboard.writeText(text);
    setTimeout(() => {
      this.isCopy.set(false);
    }, 2000);
  }

}
