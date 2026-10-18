import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ZoneService } from './zone.service';

describe('Zone page API requests', () => {
  let service: ZoneService; let http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }); service = TestBed.inject(ZoneService); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  it('sends warehouse and pagination filters in one zone query', () => {
    service.list(7, 2, 'Patio').subscribe();
    const request = http.expectOne(req => req.url.endsWith('/zones'));
    expect(request.request.params.get('warehouseId')).toBe('7'); expect(request.request.params.get('page')).toBe('2'); expect(request.request.params.get('name')).toBe('Patio'); request.flush({ data: [], meta: {} });
  });
  it('reads stock for only the chosen zone without a product assignment', () => {
    service.products(9, 3).subscribe(); const request = http.expectOne(req => req.url.endsWith('/zones/9/products'));
    expect(request.request.method).toBe('GET'); expect(request.request.params.get('page')).toBe('3'); request.flush({ data: [], meta: {} });
  });
  it('creates a zone in its selected warehouse and renames without moving it', () => {
    service.create(7, 'Zona nueva').subscribe(); const create = http.expectOne(req => req.url.endsWith('/zones')); expect(create.request.body).toEqual({ warehouseId: 7, name: 'Zona nueva' }); create.flush({});
    service.update(9, 'Otro nombre').subscribe(); const update = http.expectOne(req => req.url.endsWith('/zones/9')); expect(update.request.method).toBe('PATCH'); expect(update.request.body).toEqual({ name: 'Otro nombre' }); update.flush({});
  });
});
