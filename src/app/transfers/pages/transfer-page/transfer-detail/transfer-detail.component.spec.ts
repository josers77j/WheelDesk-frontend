import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { TransferDetailComponent } from './transfer-detail.component';
import { TransferService } from '../../../services/transfer.service';
import { ZoneService } from '../../../../zones/services/zone.service';
import { WarehouseService } from '../../../../warehouses/services/warehouse.service';
import { ProductService } from '../../../../products/services/product.service';
import { AlertService } from '../../../../shared/components/alert/alert.service';

describe('Transfer review sidebar', () => {
  it('requires distinct zones and at least one product without making requests', () => {
    TestBed.configureTestingModule({ providers: [
      { provide: QueryClient, useFactory: () => new QueryClient() },
      { provide: Location, useValue: {} }, { provide: Router, useValue: {} },
      { provide: TransferService, useValue: {} }, { provide: ZoneService, useValue: {} },
      { provide: WarehouseService, useValue: {} }, { provide: ProductService, useValue: {} },
      { provide: AlertService, useValue: {} },
    ] });
    const component = TestBed.runInInjectionContext(() => new TransferDetailComponent(TestBed.inject(Location)));
    expect(component.reviewItems().every(item => !item.complete)).toBeTrue();
    component.selectedFromZone.set({ id: 1, name: 'Origen' }); component.selectedToZone.set({ id: 1, name: 'Origen' });
    component.transferForm.patchValue({ fromZoneId: 1, toZoneId: 1 });
    expect(component.reviewItems()[1].complete).toBeFalse();
    component.selectedToZone.set({ id: 2, name: 'Destino' }); component.transferForm.patchValue({ toZoneId: 2 });
    expect(component.reviewItems()[1].complete).toBeTrue();
    expect(component.reviewItems()[2].complete).toBeFalse();
  });
});
