import { Component, inject, Input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

import { Transfer } from '../../interfaces/transfer.interface';
import { TransferService } from '../../services/transfer.service';
import { TRANSFER_STATUS } from '../../enums/transfer-status.enum';
import { TransferStatusPipe } from '../../pipes/transfer-status.pipe';

@Component({
  selector: 'app-transfer-table',
  imports: [DatePipe, SkeletonComponent, TransferStatusPipe],
  templateUrl: './transfer-table.component.html',
})
export class TransferTableComponent {
  @Input({ required: true }) transfers: Transfer[] | undefined;
  @Input() isLoading = false;
  @Input() skeletonLimit = 10;
  /** Desplazamiento base: (página - 1) × límite. Lo pasa la página. */
  @Input() rowOffset = 0;

  rowSelected = signal<number>(0);
  transferService = inject(TransferService);
  transferStatus = TRANSFER_STATUS;

  changeRowSelectedStatus(id: number) {
    const selectedId = this.transferService.transferIdSelected();

    if (selectedId === id) {
      this.transferService.transferIdSelected.set(0);

      return;
    }
    this.transferService.transferIdSelected.set(id);
  }
}