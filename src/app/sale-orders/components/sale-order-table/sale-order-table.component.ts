import { Component, inject, input } from '@angular/core';
import { SaleOrder } from '../../interfaces/sale-order.interface';
import { SaleOrderService } from '../../services/sale-order.service';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { SALE_ORDER_STATUS } from '../../enums/sale-order-status.enum';
import { SaleOrderStatusPipe } from '../../pipes/sale-order-status.pipe';
import { DteTypePipe } from '../../pipes/dte-type.pipe';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-sale-order-table',
  imports: [CurrencyPipe, DatePipe, SaleOrderStatusPipe, DteTypePipe, SkeletonComponent],
  templateUrl: './sale-order-table.component.html',
})
export class SaleOrderTableComponent {
  saleOrders = input<SaleOrder[]>();
  isLoading = input<boolean>(false);
  skeletonLimit = input<number>(10);
  /** Desplazamiento base: (página - 1) × límite. Lo pasa la página. */
  rowOffset = input<number>(0);

  saleOrderService = inject(SaleOrderService);
  saleOrderStatus = SALE_ORDER_STATUS;

  changeRowSelectedStatus(id: number) {
    const selectedId = this.saleOrderService.selectedSaleOrderId();

    if (selectedId === id) {
      this.saleOrderService.selectedSaleOrderId.set(0);
      return;
    }
    this.saleOrderService.selectedSaleOrderId.set(id);
  }
}
