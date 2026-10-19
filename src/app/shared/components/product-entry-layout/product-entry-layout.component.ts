import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-product-entry-layout',
  templateUrl: './product-entry-layout.component.html',
  styleUrl: './product-entry-layout.component.css',
})
export class ProductEntryLayoutComponent {
  readonly title = input('Agregar producto');
  readonly description = input('');
  readonly footerNote = input('');
  readonly closed = output<void>();
}
