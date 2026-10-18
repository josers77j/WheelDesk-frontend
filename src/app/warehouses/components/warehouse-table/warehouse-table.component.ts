import { Component, inject, Input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

import { Warehouse } from '../../interfaces/warehouse.interface';
import { WarehouseService } from '../../services/warehouse.service';

@Component({
  selector: 'app-warehouse-table',
  imports: [DatePipe, SkeletonComponent],
  templateUrl: './warehouse-table.component.html',
})
export class WarehouseTableComponent {
  @Input({ required: true }) warehouses: Warehouse[] | undefined;
  @Input() isLoading = false;
  @Input() skeletonLimit = 10;
  /** Desplazamiento base: (página - 1) × límite. Lo pasa la página. */
  @Input() rowOffset = 0;

  rowSelected = signal<number>(0);
  deleteConfirmation = signal<boolean>(false);
  warehouseService = inject(WarehouseService);

  changeRowSelectedStatus(id: number) {
    const selectedId = this.warehouseService.warehouseIdSelected();

    if (selectedId === id) {
      this.warehouseService.warehouseIdSelected.set(0);

      return;
    }
    this.warehouseService.warehouseIdSelected.set(id);
  }
}