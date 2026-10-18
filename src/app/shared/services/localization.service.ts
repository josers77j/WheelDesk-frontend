import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ValueParams } from '../components/combobox/interfaces/search-param.interface';
import { Observable, of } from 'rxjs';

const baseUrl = environment.baseUrl;

@Injectable({
  providedIn: 'root'
})
export class LocalizationService {

  http = inject(HttpClient)

  getDistrict(filter: string, municipalityId: number):Observable<ValueParams[]> {

    if(!municipalityId) return of([])

    return this.http.get<ValueParams[]>(`${baseUrl}/locations/district`, {
      params: {
        municipalityId: municipalityId, filter: filter
      }
    })

  }

  getMunicipality(filter: string, departmentId: number) {
    if(!departmentId) return of([])
    return this.http.get<ValueParams[]>(`${baseUrl}/locations/municipality`, {
      params: {
        departmentId: departmentId, filter: filter
      }
    })
  }

  getDepartment(filter: string) {
    return this.http.get<ValueParams[]>(`${baseUrl}/locations/department`, {
      params: {
        filter: filter
      }
    })
  }


}
