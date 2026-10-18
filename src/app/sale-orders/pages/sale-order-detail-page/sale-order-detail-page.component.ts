import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SaleOrderCheckoutComponent } from './sale-order-checkout/sale-order-checkout.component';

@Component({
  selector: 'app-sale-order-detail-page',
  imports: [SaleOrderCheckoutComponent, RouterLink],
  templateUrl: './sale-order-detail-page.component.html',
})
export class SaleOrderDetailPageComponent {
  private readonly activatedRoute = inject(ActivatedRoute);

  /** Por ahora solo existe la creación (`detail/0`); el detalle de una orden se verá luego. */
  orderId = computed(() => this.activatedRoute.snapshot.paramMap.get('id'));
  isNew = computed(() => this.orderId() === '0');
}
