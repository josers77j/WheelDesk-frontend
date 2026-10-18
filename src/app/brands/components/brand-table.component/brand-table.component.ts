import { Component, inject, Input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

import { Brand } from '../../interfaces/brand.interface';
import { BrandService } from '../../services/brand.service';

@Component({
  selector: 'app-brand-table',
  imports: [DatePipe, SkeletonComponent],
  templateUrl: './brand-table.component.html',
})
export class BrandTableComponent {
  @Input({ required: true }) brands: Brand[] | undefined;
  @Input() isLoading = false;
  @Input() skeletonLimit = 10;
  /** Desplazamiento base: (página - 1) × límite. Lo pasa la página. */
  @Input() rowOffset = 0;

  rowSelected = signal<number>(0);
  deleteConfirmation = signal<boolean>(false);
  brandService = inject(BrandService);

  changeRowSelectedStatus(id: number) {
    const selectedId = this.brandService.brandIdSelected();

    if (selectedId === id) {
      this.brandService.brandIdSelected.set(0);

      return;
    }
    this.brandService.brandIdSelected.set(id);
  }
}
