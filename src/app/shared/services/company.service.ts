import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TaxDocumentTypeResponse } from '../interfaces/tax-document-type.interface';
import { EconomicActivityResponse } from '../interfaces/economic-activity.interface';

const baseUrl = environment.baseUrl;

export interface CatalogItem {
  id: number;
  name: string;
  code?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CompanyService {

    http = inject(HttpClient)

  getTaxDocumentType():Observable<TaxDocumentTypeResponse[]> {
    return this.http.get<TaxDocumentTypeResponse[]>(`${baseUrl}/company/tax-document-type`, {
    })

  }

    getEconomicActivity(filter: string):Observable<EconomicActivityResponse[]> {
    return this.http.get<EconomicActivityResponse[]>(`${baseUrl}/company/economic-activity`, {
      params:{
        filter
      }
    })

  }

  getItemTypes(): Observable<CatalogItem[]> {
    return this.http.get<CatalogItem[]>(`${baseUrl}/catalog/category/item-type`);
  }

  getUnitOfMeasures(): Observable<CatalogItem[]> {
    return this.http.get<CatalogItem[]>(`${baseUrl}/catalog/category/unit-of-measure`);
  }
}
