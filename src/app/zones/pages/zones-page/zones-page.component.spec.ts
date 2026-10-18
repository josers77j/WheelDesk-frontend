import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { ZonesPageComponent } from './zones-page.component';
import { ZoneService } from '../../services/zone.service';
import { WarehouseService } from '../../../warehouses/services/warehouse.service';
import { AuthService } from '../../../auth/services/auth.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { Zone } from '../../../warehouses/interfaces/warehouse.interface';

describe('Zones by warehouse', () => {
  const zone: Zone = { id: 9, name: 'Zona A', warehouseId: 2, createdAt: new Date(), updatedAt: null, deletedAt: null };
  const role = signal({ role: 'ADMIN' });
  const api = { list: jasmine.createSpy('list'), products: jasmine.createSpy('products'), create: jasmine.createSpy('create'), update: jasmine.createSpy('update'), deleteZone: jasmine.createSpy('delete') };
  beforeEach(() => {
    role.set({ role: 'ADMIN' }); Object.values(api).forEach(spy => spy.calls.reset());
    api.list.and.returnValue(of({ data: [], meta: { page: 1, total: 0, totalPages: 0 } }));
    api.products.and.returnValue(of({ data: [], meta: { page: 1, total: 0, totalPages: 0 } })); api.create.and.returnValue(of({})); api.update.and.returnValue(of({}));
    TestBed.configureTestingModule({ imports: [ZonesPageComponent], providers: [
      { provide: QueryClient, useFactory: () => new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
      { provide: ZoneService, useValue: api },
      { provide: WarehouseService, useValue: { getWarehouseById: () => of({ id: 2, name: 'Bodega' }), searchWarehousesByName: () => of([]) } },
      { provide: AuthService, useValue: { user: role } },
      { provide: AlertService, useValue: { showError: jasmine.createSpy('error'), showSuccess: jasmine.createSpy('success') } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ warehouseId: '2' }) } } },
      { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
    ] });
    TestBed.overrideComponent(ZonesPageComponent, { set: { template: '', imports: [] } });
  });
  it('resets the zone, product page and edit draft when switching warehouses', () => {
    const component = TestBed.createComponent(ZonesPageComponent).componentInstance;
    component.select(zone); component.productPage.set(3); component.page.set(4); component.edit(zone);
    component.chooseWarehouse({ id: 5, name: 'Otra bodega' });
    expect(component.warehouseId()).toBe(5); expect(component.selected()).toBeNull(); expect(component.productPage()).toBe(1); expect(component.page()).toBe(1); expect(component.editing()).toBeNull();
  });
  it('does not create a zone with a whitespace-only name', async () => {
    const component = TestBed.createComponent(ZonesPageComponent).componentInstance;
    component.name.setValue('   '); await component.save(); expect(api.create).not.toHaveBeenCalled(); expect(component.attempted()).toBeTrue();
  });
  it('prevents read-only users from creating or deleting zones', async () => {
    role.set({ role: 'VIEWER' }); const component = TestBed.createComponent(ZonesPageComponent).componentInstance;
    component.name.setValue('Nueva'); await component.save(); component.deleting.set(zone); await component.remove();
    expect(api.create).not.toHaveBeenCalled(); expect(api.deleteZone).not.toHaveBeenCalled();
  });
});
