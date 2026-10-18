import { Pipe, type PipeTransform } from '@angular/core';
import { SALE_ORDER_STATUS } from '../enums/sale-order-status.enum';

@Pipe({
  name: 'SaleOrderStatus',
})
export class SaleOrderStatusPipe implements PipeTransform {
  transform(value: SALE_ORDER_STATUS | string): string {
    const labelStatus: Record<string, string> = {
      COMPLETED: 'Completada',
      REJECTED: 'Rechazada',
      PENDING: 'Pendiente',
      ANNULLED: 'Anulada',
      CONTINGENCY: 'Contingencia',
    };

    return labelStatus[value] ?? value;
  }
}
