import { Component, inject } from '@angular/core';
import { BrandDetailComponent } from './brand-detail/brand-detail.component';
import { BrandService } from '../../services/brand.service';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { FormSkeletonComponent } from '../../../shared/components/form-skeleton/form-skeleton.component';

@Component({
  selector: 'app-brand-page.component',
  imports: [BrandDetailComponent, FormSkeletonComponent],
  templateUrl: './brand-page.component.html',
})
export class BrandPageComponent {

  brandService = inject(BrandService);
  router = inject(Router)
  activatedRoute = inject(ActivatedRoute);

  brandId = toSignal(this.activatedRoute.params.pipe(
    map((param) => param['id'])
  ));

  brandResource = rxResource({
    request: () => ({id: +this.brandId()}),
    loader: ({request}) => {
      return this.brandService.getBrandById(request.id)
    }
  })

}
