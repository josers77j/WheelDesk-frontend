import { HttpClient } from '@angular/common/http';
import { environment } from './../../../environments/environment';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, of, throwError } from 'rxjs';
import { Customer, CustomerPayload, CustomerResponse } from '../interfaces/customer.interface';

const baseUrl = environment.baseUrl;
export const emptyCustomer: Customer = {
  id: 0,
  name: '',
  isTaxPayer: false,
  email: '',
  phone: '',
  customerType: null,
  districtId: 0,
  address: '',
  createdById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  district: null,
  taxInfo: {
    id: 0,
    tradeName: '',
    customerId: 0,
    taxDocumentTypeId: 0,
    taxDocumentNumber: '',
    economicActivity: undefined,
    nrc: '',
    economicActivityId: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  http = inject(HttpClient);
  customerIdSelected = signal<number>(0);

  getCustomers(
    page: number,
    limit: number,
    filter: string,
  ): Observable<CustomerResponse> {
    return this.http
      .get<CustomerResponse>(`${baseUrl}/customers`, {
        params: { page, limit, filter },
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

  getCustomerById(id: number): Observable<Customer> {
    if (id === 0) {
      return of(emptyCustomer);
    }

    return this.http.get<Customer>(`${baseUrl}/customers/${id}`).pipe(
      catchError((exception) => {
        return throwError(() => ({
          message: exception['error'].message,
          status: exception['error'].statusCode,
        }));
      }),
    );
  }

  createCustomer(customerLike: CustomerPayload): Observable<Customer> {
    return this.http
      .post<Customer>(`${baseUrl}/customers`, {
        ...customerLike,
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

  updateCustomer(
    id: number,
    customerLike: CustomerPayload,
  ): Observable<Customer> {
    return this.http
      .patch<Customer>(`${baseUrl}/customers/${id}`, {
        ...customerLike,
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

  deleteCustomer(id: number): Observable<Customer> {
    return this.http.delete<Customer>(`${baseUrl}/customers/${id}`).pipe(
      catchError((exception) => {
        return throwError(() => ({
          message: exception['error'].message,
          status: exception['error'].statusCode,
        }));
      }),
    );
  }
}
