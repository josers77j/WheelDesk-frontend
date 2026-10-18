import { Component, inject } from '@angular/core';
import { TireTabComponent } from './tire-tab/tire-tab.component';
import { ServiceTabComponent } from './service-tab/service-tab.component';
import { ProductService } from '../../services/product.service';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { SupplyTabComponent } from "./supply-tab/supply-tab.component";

@Component({
  selector: 'app-products-page',
  imports: [TireTabComponent, ServiceTabComponent, SupplyTabComponent],
  templateUrl: './products-page.component.html',
})
export class ProductsPageComponent {

  tabOptions = {
    tire:'tire',
    service:'service',
    supply: 'supply'
  }

  activatedRoute = inject(ActivatedRoute)
  router = inject(Router)
  productService = inject(ProductService)

  tabType = toSignal(this.activatedRoute.queryParamMap.pipe(
    map((params)=> params.get('tabType') ?? this.tabOptions.tire)
  ), {
    initialValue: this.tabOptions.tire
  } )

  destroyIdSelected(){
    this.productService.productIdSelected.set(0);
  }

  changeQueryParam(tabValue: string){

    if(this.tabType() === tabValue) return ;

    this.router.navigate([],
      {
        queryParams: {
          tabType: tabValue
        },
        replaceUrl:true
      }
    )
  }

}
