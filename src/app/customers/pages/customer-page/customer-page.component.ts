import { Component, inject } from '@angular/core';
import { CustomerService } from '../../services/customer.service';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { CustomerDetailPageComponent } from "./customer-detail-page/customer-detail-page.component";
import { FormSkeletonComponent } from '../../../shared/components/form-skeleton/form-skeleton.component';

@Component({
  selector: 'app-customer-page.component',
  imports: [CustomerDetailPageComponent, FormSkeletonComponent],
  templateUrl: './customer-page.component.html',
})
export class CustomerPageComponent {
    customerService = inject(CustomerService);
  router = inject(Router)
  activatedRoute = inject(ActivatedRoute);

  customerId = toSignal(this.activatedRoute.params.pipe(
    map((param) => param['id'])
  ));


  customerResource = rxResource({
    request: () => ({id: +this.customerId()}),
    loader: ({request}) => {
      return this.customerService.getCustomerById(request.id)
    }
  })
}
