import { Component, inject, input, signal } from '@angular/core';
import { Product } from '../../interfaces/product.interface';
import { ProductService } from '../../services/product.service';
import { EmptyNumberFieldPipe } from '../../pipes/empty-number-field.pipe';
import { CurrencyPipe } from '@angular/common';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-service-table',
  imports: [EmptyNumberFieldPipe, CurrencyPipe, SkeletonComponent],
  templateUrl: './service-table.component.html',
})
export class ServiceTableComponent {
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
