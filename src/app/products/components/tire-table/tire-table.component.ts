import { Component, inject, input, signal } from '@angular/core';
import { ProductService } from '../../services/product.service';

import { EmptyFieldPipe } from '../../pipes/empty-field.pipe';

import { CurrencyPipe } from '@angular/common';
import { EmptyNumberFieldPipe } from '../../pipes/empty-number-field.pipe';
import { TireConditionPipe } from '../../pipes/tire-condition.pipe';
import { Product } from '../../interfaces/product.interface';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-tire-table',
  imports: [
    EmptyFieldPipe,
    EmptyNumberFieldPipe,
    CurrencyPipe,
    TireConditionPipe,
    SkeletonComponent,
  ],
  templateUrl: './tire-table.component.html',
})
export class TireTableComponent {
  products = input<Product[]>();
  isLoading = input<boolean>(false);
  skeletonLimit = input<number>(10);
  /** Desplazamiento base: (página - 1) × límite. Lo pasa la página. */
  rowOffset = input<number>(0);

  rowSelected = signal<number>(0);
  deleteConfirmation = signal<boolean>(false);
  productService = inject(ProductService);

  changeRowSelectedStatus(id: number) {
    const selectedId = this.productService.productIdSelected();

    if (selectedId === id) {
      this.productService.productIdSelected.set(0);

      return;
    }
    this.productService.productIdSelected.set(id);
  }
}
