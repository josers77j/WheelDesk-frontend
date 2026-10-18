import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

const baseUrl = environment.baseUrl;

/**
 * Hacienda catalogs available at `catalog/category/:catalog`.
 * Keys must stay in kebab case and match the backend `CatalogType` exactly.
 */
export type CatalogType =
  | 'economic-activity'
  | 'tax-document-type'
  | 'document-type'
  | 'billing-model'
  | 'transmission-type'
  | 'contingency-type'
  | 'establishment-type'
  | 'item-type'
  | 'unit-of-measure'
  | 'tribute'
  | 'operation-condition'
  | 'payment-methode'
  | 'payment-term'
  | 'other-associated-document'
  | 'contingency-document'
  | 'invalidation-type';

export interface CatalogItem {
  id: number;
  name: string;
  code?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class CatalogService {

  http = inject(HttpClient)

  getCatalog(catalog: CatalogType, filter?: string):Observable<CatalogItem[]> {

    return this.http.get<CatalogItem[]>(`${baseUrl}/catalog/category/${catalog}`, {
      params: filter ? { filter } : {}
    })

  }
}
