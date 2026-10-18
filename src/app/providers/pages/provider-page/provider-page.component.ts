import { Component, inject } from '@angular/core';
import { ProviderService } from '../../services/provider.service';
import { ActivatedRoute, Router } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ProviderDetailComponent } from './provider-detail/provider-detail.component';
import { FormSkeletonComponent } from '../../../shared/components/form-skeleton/form-skeleton.component';

@Component({
  selector: 'app-provider-page.component',
  imports: [ProviderDetailComponent, FormSkeletonComponent],
  templateUrl: './provider-page.component.html',
})
export class ProviderPageComponent {
  providerService = inject(ProviderService);
  router = inject(Router)
  activatedRoute = inject(ActivatedRoute);

  providerId = toSignal(this.activatedRoute.params.pipe(
    map((param) => param['id'])
  ));

  providerResource = rxResource({
    request: () => ({id: +this.providerId()}),
    loader: ({request}) => {
      return this.providerService.getProviderById(request.id)
    }
  })

}
