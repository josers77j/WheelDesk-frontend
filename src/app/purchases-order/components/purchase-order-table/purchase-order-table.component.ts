import { Component, inject, input, output, signal } from '@angular/core';
import { PurchaseOrder } from '../../interfaces/purchase-order.interface';

import { PurchaseOrderService } from '../../services/purchase-order.service';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { PURCHASE_ORDER_STATUS } from '../../enums/purchase-order-status.enum';
import { CorrelativeParsePipe } from '../../../shared/pipes/correlative-parse.pipe';
import { PurchaseOrderStatusPipe } from '../../pipes/purchase-order-status.pipe';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-purchase-order-table',
  imports: [
    CurrencyPipe,
    DatePipe,
    CorrelativeParsePipe,
    PurchaseOrderStatusPipe,
    SkeletonComponent,
  ],
  templateUrl: './purchase-order-table.component.html',
})
export class PurchaseOrderTableComponent {
  purchaseOrder = input<PurchaseOrder[]>();
  checkedIds = input<readonly number[]>([]);
  checkedChange = output<number>();
  toggleChecked(id: number, event: Event): void { event.stopPropagation(); this.checkedChange.emit(id); }
  isLoading = input<boolean>(false);
  skeletonLimit = input<number>(10);
  /** Desplazamiento base: (página - 1) × límite. Lo pasa la página. */
  rowOffset = input<number>(0);

  rowSelected = signal<number>(0);
  deleteConfirmation = signal<boolean>(false);
  PurchaseOrderService = inject(PurchaseOrderService);
  purchaseOrderStatus = PURCHASE_ORDER_STATUS;

  changeIdSelector(id: number) {
    this.PurchaseOrderService.selectedPurchaseOrderId.set(id);
  }

  changeRowSelectedStatus(id: number) {
    const selectedId = this.PurchaseOrderService.selectedPurchaseOrderId();

    if (selectedId === id) {
      this.PurchaseOrderService.selectedPurchaseOrderId.set(0);

      return;
    }
    this.PurchaseOrderService.selectedPurchaseOrderId.set(id);
  }
}
