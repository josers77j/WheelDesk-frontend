import { Pipe, type PipeTransform } from '@angular/core';
import { PURCHASE_ORDER_STATUS } from '../enums/purchase-order-status.enum';

@Pipe({
  name: 'PurchaseOrderStatus',
})
export class PurchaseOrderStatusPipe implements PipeTransform {

  transform(value: PURCHASE_ORDER_STATUS): string {

    const labelStatus = {
      COMPLETED: 'Completado',
      REJECTED:'Rechazado',
      PENDING:'Pendiente'
    }

    const currentStatus = labelStatus[value]

    return currentStatus;
  }

}
