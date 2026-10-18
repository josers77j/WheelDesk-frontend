import { AssistedPurchaseComponent } from '../../components/assisted-purchase/assisted-purchase.component';
import { Component, inject } from '@angular/core';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { FormSkeletonComponent } from '../../../shared/components/form-skeleton/form-skeleton.component';

@Component({
  selector: 'app-purchase-order-page',
  imports: [AssistedPurchaseComponent, FormSkeletonComponent],
  templateUrl: './purchase-order-page.component.html',
})
export class PurchaseOrderPageComponent {
  purchaseOrderService = inject(PurchaseOrderService);

  activatedRoute = inject(ActivatedRoute);
  route = inject(Router);

  purchaseOrderId = toSignal(
    this.activatedRoute.params.pipe(map((params) => params['id'])),
  );

  purchaseOrderResource = rxResource({
    request: () => ({ id: +this.purchaseOrderId() }),
    loader: ({ request }) => {
      return this.purchaseOrderService.getPurchaseOrder(request.id);
    },
  });
}
