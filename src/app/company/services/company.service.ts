import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CompanySettings, UpdateCompanySettings } from '../interfaces/company.interface';

const baseUrl = environment.baseUrl;

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly http = inject(HttpClient);

  getCompany() {
    return this.http.get<CompanySettings | null>(`${baseUrl}/company`);
  }

  updateCompany(id: number, payload: UpdateCompanySettings) {
    return this.http.patch<CompanySettings>(
      `${baseUrl}/company/${id}`,
      payload,
    );
  }
}
