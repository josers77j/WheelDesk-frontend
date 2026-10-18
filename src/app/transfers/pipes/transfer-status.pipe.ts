import { Pipe, type PipeTransform } from '@angular/core';
import { TRANSFER_STATUS } from '../enums/transfer-status.enum';

@Pipe({
  name: 'TransferStatus',
})
export class TransferStatusPipe implements PipeTransform {
  transform(value?: TRANSFER_STATUS): string {
    const labelStatus: Partial<Record<TRANSFER_STATUS, string>> = {
      COMPLETED: 'Completada',
      CANCELLED: 'Cancelada',
      PENDING: 'Pendiente',
    };

    return value ? labelStatus[value] ?? '' : '';
  }
}