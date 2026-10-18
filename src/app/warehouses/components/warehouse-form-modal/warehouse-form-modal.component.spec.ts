import { TestBed } from '@angular/core/testing';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { WarehouseFormModalComponent } from './warehouse-form-modal.component';
import { WarehouseService } from '../../services/warehouse.service';
import { ZoneService } from '../../../zones/services/zone.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { Warehouse } from '../../interfaces/warehouse.interface';

describe('Warehouse zone-only editing', () => {
  const warehouse: Warehouse = { id: 7, name: 'Bodega central', address: '', zones: [], createdAt: new Date(), updatedAt: null, deletedAt: null };
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [WarehouseFormModalComponent], providers: [
      { provide: QueryClient, useFactory: () => new QueryClient() },
      { provide: WarehouseService, useValue: { updateWarehouse: () => of(warehouse), createWarehouse: () => of(warehouse) } },
      { provide: ZoneService, useValue: { deleteZone: () => of({}) } },
      { provide: AlertService, useValue: { showError: jasmine.createSpy('error'), showSuccess: jasmine.createSpy('success') } },
    ] });
  });
  it('enables updating after adding only a zone and disables it again when removed', () => {
    const fixture = TestBed.createComponent(WarehouseFormModalComponent);
    fixture.detectChanges();
    fixture.componentInstance.openForEdit(warehouse);
    fixture.detectChanges();
    const host: unknown = fixture.nativeElement;
    if (!(host instanceof HTMLElement)) throw new Error('Expected warehouse form host');
    const submit = host.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submit?.disabled).toBeTrue();
    fixture.componentInstance.zoneNameInput.set('Zona nueva');
    fixture.componentInstance.addZone(); fixture.detectChanges();
    expect(submit?.disabled).toBeFalse();
    fixture.componentInstance.removeNewZone(0); fixture.detectChanges();
    expect(submit?.disabled).toBeTrue();
  });
  it('sends the new zone with the unchanged warehouse in one update', async () => {
    const fixture = TestBed.createComponent(WarehouseFormModalComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.openForEdit(warehouse);
    const update = spyOn(TestBed.inject(WarehouseService), 'updateWarehouse').and.returnValue(of(warehouse));
    component.zoneNameInput.set('Zona nueva'); component.addZone(); component.onSubmit();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(update).toHaveBeenCalledOnceWith(7, { name: 'Bodega central', address: '', zones: [{ name: 'Zona nueva' }] });
  });
});
