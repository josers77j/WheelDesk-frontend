import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';

import { Product, ProductResponse, ProductTirePayload } from '../interfaces/product.interface';
import { SearchParams } from '../interfaces/search-param.interface';
import { catchError, Observable, of, throwError } from 'rxjs';
import { PRODUCT_TYPE } from '../interfaces/product-type.enum';
import { ValueParams } from '../../shared/components/combobox/interfaces/search-param.interface';

const baseUrl = environment.baseUrl;
type ProductCategory = 'TIRE' | 'SUPPLY' | 'SERVICE';

export const emptyProduct: Product = {
  id: 0,
  name: '',
  sku: null,
  type: '',
  purchasePrice: '',
  salePrice: '',
  stock: 0,
  notes: null,
  brandId: null,
  providerId: null,
  createdById: null,
  updatedById: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  deletedAt: null,
  brand: null,
  tire: null,
  provider: null,
};

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  http = inject(HttpClient);
  productIdSelected = signal<number>(0);

  getProducts(
    type: ProductCategory,
    page: number,
    limit: number,
    appliedSearchParams: SearchParams,
  ) {
    const { width, aspectRatio, rimDiameter, brandId, providerId, filter, quantityStatus } =
      appliedSearchParams;
    // quantityStatus se omite si es ALL/vacío: el back trae todo por defecto
    // (y el '' rompería el @IsEnum con 400).
    const params: Record<string, string | number> = {
      type,
      page,
      limit,
      width: width ?? '',
      aspectRatio: aspectRatio ?? '',
      rimDiameter: rimDiameter ?? '',
      brandId: brandId ?? '',
      providerId: providerId ?? '',
      filter: filter ?? '',
    };
    if (quantityStatus && quantityStatus !== 'ALL') {
      params['quantityStatus'] = quantityStatus;
    }
    return this.http
      .get<ProductResponse>(`${baseUrl}/products`, { params })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  createTire(createTire: Partial<ProductTirePayload>): Observable<Product> {
    return this.http
      .post<Product>(`${baseUrl}/products/create-tire`, createTire)
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  getVehicleTypes(): Observable<{ id: number; name: string }[]> {
    return this.http
      .get<{ id: number; name: string }[]>(`${baseUrl}/products/vehicle-types`)
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  updateTire(id: number, updateTire: Partial<ProductTirePayload>): Observable<Product> {
    return this.http
      .patch<Product>(`${baseUrl}/products/update-tire/${id}`, updateTire)
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  createService(createService: Partial<Product>): Observable<Product> {
    return this.http
      .post<Product>(`${baseUrl}/products/create-service`, createService)
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  updateService(
    id: number,
    updateService: Partial<Product>,
  ): Observable<Product> {
    return this.http
      .patch<Product>(`${baseUrl}/products/update-service/${id}`, updateService)
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  createSupply(createSupply: Partial<Product>): Observable<Product> {
    return this.http
      .post<Product>(`${baseUrl}/products/create-supply`, createSupply)
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  updateSupply(
    id: number,
    updateSupply: Partial<Product>,
  ): Observable<Product> {
    return this.http
      .patch<Product>(`${baseUrl}/products/update-supply/${id}`, updateSupply)
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  getProductById(id: number, productType: PRODUCT_TYPE): Observable<Product> {
    if (id === 0) return of(emptyProduct);

    return this.http
      .get<Product>(`${baseUrl}/products/${id}`, {
        params: {
          productType,
        },
      })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  getSummaryByName(
    filter: string,
    quantityStatus?: 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK',
    type?: 'TIRE' | 'SUPPLY' | 'SERVICE',
    zoneId?: number,
    limit?: number,
  ): Observable<ValueParams[]> {
    return this.http
      .get<ValueParams[]>(`${baseUrl}/products/summary`, {
        params: {
          filter,
          ...(quantityStatus ? { quantityStatus } : {}),
          ...(type ? { type } : {}),
          ...(zoneId !== undefined ? { zoneId } : {}),
          ...(limit !== undefined ? { limit } : {}),
        },
      })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message: exception['error'].message,
            status: exception['error'].statusCode,
          }));
        }),
      );
  }

  deleteProduct(id: number) {
    return this.http.delete(`${baseUrl}/products/${id}`).pipe(
      catchError((exception) => {
        return throwError(() => ({
          message: exception['error'].message,
          status: exception['error'].statusCode,
        }));
      }),
    );
  }

  uploadProductImages(productId: number, files: File[]) {
    const formData = new FormData();
    formData.set('id', String(productId));
    for (const file of files) formData.append('productImages', file);
    return this.http
      .post<{ uploaded: number; failed: string[] }>(
        `${baseUrl}/products/create-product-image`,
        formData,
      )
      .pipe(
      catchError((exception) => {
        return throwError(() => ({
          message:
            exception['error'].message ?? 'Error al subir las imágenes',
          status: exception['error'].statusCode,
        }));
      }),
    );
  }

  deleteProductImages(productId: number, imageIds: number[]) {
    return this.http
      .delete(`${baseUrl}/products/delete-product-image`, {
        body: { productId, imageIds },
      })
      .pipe(
        catchError((exception) => {
          return throwError(() => ({
            message:
              exception['error'].message ?? 'Error al eliminar las imágenes',
            status: exception['error'].statusCode,
          }));
        }),
      );
  }
}
