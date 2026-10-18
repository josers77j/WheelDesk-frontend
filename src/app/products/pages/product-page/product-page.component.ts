
import { Component, inject, signal } from '@angular/core';
import { TireDetailPageComponent } from './tire-detail-page/tire-detail-page.component';
import { ProductService } from '../../services/product.service';
import { ActivatedRoute, Router } from '@angular/router';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of} from 'rxjs';
import { PRODUCT_TYPE } from '../../interfaces/product-type.enum';
import { ServiceDetailComponent } from './service-detail/service-detail.component';
import { SupplyDetailPageComponent } from "./supply-detail-page/supply-detail-page.component";
import { FormSkeletonComponent } from '../../../shared/components/form-skeleton/form-skeleton.component';
import { ErrorBanner, ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';


@Component({
  selector: 'app-product-page',
  imports: [
    TireDetailPageComponent,
    ServiceDetailComponent,
    SupplyDetailPageComponent,
    FormSkeletonComponent,
    ErrorBannerComponent],
  templateUrl: './product-page.component.html',
})
export class ProductPageComponent {

  productService = inject(ProductService);
  router = inject(Router)
  activatedRoute = inject(ActivatedRoute);

  readonly PRODUCT_TYPE = PRODUCT_TYPE;


  productId = toSignal(this.activatedRoute.params.pipe(
    map((param) => param['id'])
  ));

  productType = toSignal( this.activatedRoute.queryParamMap.pipe(
    map(params => params.get('productType')),
    map(type => Object.values(PRODUCT_TYPE).includes(type as PRODUCT_TYPE) ? (type as PRODUCT_TYPE): PRODUCT_TYPE.TIRE)
  ) )

  productResource = rxResource({
    request: () => ({id: +this.productId(), productType: this.productType()!}),
    loader: ({request}) => {
      return this.productService.getProductById(request.id, request.productType).pipe(
        catchError((error: ErrorBanner) => {
          this.productError.set(error)
          return of(undefined)

        })
      )
    }
  })



  productError = signal<ErrorBanner>({message:'', error:''})

}
