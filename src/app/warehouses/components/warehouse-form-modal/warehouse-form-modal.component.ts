import {
  Component,
  ElementRef,
  inject,
  output,
  signal,
  computed,
  ViewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  injectMutation,
  QueryClient,
} from '@tanstack/angular-query-experimental';

import {
  CreateWarehousePayload,
  Warehouse,
  Zone,
} from '../../interfaces/warehouse.interface';
import { WarehouseService } from '../../services/warehouse.service';
import { ZoneService } from '../../../zones/services/zone.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { FormErrorLabelComponent } from '../../../shared/components/form-error-label/form-error-label.component';
import { invalidateCatalogCaches } from '../../../shared/utils/invalidate-catalog-caches.util';
import { FormUtils } from '../../../shared/utils/form-utils';

@Component({
  selector: 'app-warehouse-form-modal',
  imports: [ReactiveFormsModule, FormErrorLabelComponent],
  templateUrl: './warehouse-form-modal.component.html',
})
export class WarehouseFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly warehouseService = inject(WarehouseService);
  private readonly zoneService = inject(ZoneService);
  private readonly alertService = inject(AlertService);
  private readonly queryClient = inject(QueryClient);

  @ViewChild('formModal') formModal!: ElementRef<HTMLDialogElement>;

  saved = output<Warehouse>();

  warehouseId = signal<number>(0);
  isEditing = computed(() => this.warehouseId() > 0);
  isSubmitting = signal<boolean>(false);

  existingZones = signal<Zone[]>([]);
  newZoneNames = signal<string[]>([]);
  zoneNameInput = signal<string>('');
  confirmingDeleteId = signal<number | null>(null);

  allZoneNames = computed(() => {
    const existing = this.existingZones().map((zone) =>
      zone.name.toLowerCase(),
    );
    const pending = this.newZoneNames().map((name) => name.toLowerCase());
    return [...existing, ...pending];
  });

  warehouseForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    address: [''],
  });

  private originalValue: unknown = null;

  hasChanges(): boolean {
    return this.newZoneNames().length > 0 || FormUtils.hasChanges(this.warehouseForm, this.originalValue);
  }

  addZone() {
    const name = this.zoneNameInput().trim();
    if (!name) return;

    if (
      this.allZoneNames().some(
        (zoneName) => zoneName === name.toLowerCase(),
      )
    ) {
      this.alertService.showError('Ya existe una zona con ese nombre');
      return;
    }

    this.newZoneNames.update((list) => [...list, name]);
    this.zoneNameInput.set('');
  }

  removeNewZone(index: number) {
    this.newZoneNames.update((list) => list.filter((_, i) => i !== index));
  }

  askDeleteZone(zone: Zone) {
    if (this.confirmingDeleteId() === zone.id) {
      this.mutationDeleteZone.mutate(zone.id);
      return;
    }
    this.confirmingDeleteId.set(zone.id);
    setTimeout(() => {
      if (this.confirmingDeleteId() === zone.id) {
        this.confirmingDeleteId.set(null);
      }
    }, 3000);
  }

  mutationDeleteZone = injectMutation(() => ({
    mutationFn: (id: number) =>
      firstValueFrom(this.zoneService.deleteZone(id)),
    onSuccess: (_result, zoneId) => {
      this.existingZones.update((list) =>
        list.filter((zone) => zone.id !== zoneId),
      );
      this.queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Zona eliminada con éxito');
      this.confirmingDeleteId.set(null);
    },
    onError: (error): void => {
      this.alertService.showError(
        error?.message || 'Error al eliminar la zona',
      );
      this.confirmingDeleteId.set(null);
    },
  }));

  mutationCreate = injectMutation(() => ({
    mutationFn: (warehouseLike: Partial<CreateWarehousePayload>) =>
      firstValueFrom(this.warehouseService.createWarehouse(warehouseLike)),
    onSuccess: (warehouse) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Bodega creada con éxito');
      this.saved.emit(warehouse);
      this.closeModal();
    },
    onError: (error): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(error?.message || 'Error al crear la bodega');
    },
  }));

  mutationUpdate = injectMutation(() => ({
    mutationFn: ({
      id,
      warehouseLike,
    }: {
      id: number;
      warehouseLike: Partial<CreateWarehousePayload>;
    }) =>
      firstValueFrom(this.warehouseService.updateWarehouse(id, warehouseLike)),
    onSuccess: (warehouse) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Bodega actualizada con éxito');
      this.saved.emit(warehouse);
      this.closeModal();
    },
    onError: (error): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(
        error?.message || 'Error al actualizar la bodega',
      );
    },
  }));

  openForCreate() {
    this.resetState();
    this.formModal?.nativeElement?.showModal();
  }

  openForEdit(warehouse: Warehouse) {
    this.resetState();
    this.warehouseId.set(warehouse.id);
    this.existingZones.set(warehouse.zones ?? []);
    this.warehouseForm.reset({
      name: warehouse.name,
      address: warehouse.address || '',
    });
    this.originalValue = this.warehouseForm.getRawValue();
    this.formModal?.nativeElement?.showModal();
  }

  closeModal() {
    this.formModal?.nativeElement?.close();
    this.resetState();
  }

  private resetState() {
    this.warehouseId.set(0);
    this.isSubmitting.set(false);
    this.existingZones.set([]);
    this.newZoneNames.set([]);
    this.zoneNameInput.set('');
    this.confirmingDeleteId.set(null);
    this.warehouseForm.reset({ name: '', address: '' });
  }

  onSubmit(): void {
    if (this.isSubmitting()) return;
    this.warehouseForm.markAllAsTouched();
    if (this.warehouseForm.invalid) return;

    const hasNewZones = this.newZoneNames().length > 0;
    const isUnchanged = !this.hasChanges() && !hasNewZones;

    if (this.isEditing() && isUnchanged) {
      this.closeModal();
      return;
    }

    this.isSubmitting.set(true);

    const warehouseLike: Partial<CreateWarehousePayload> = {
      name: this.warehouseForm.value.name?.trim() || '',
      address: this.warehouseForm.value.address?.trim() || '',
    };
    if (hasNewZones) {
      warehouseLike.zones = this.newZoneNames().map((name) => ({ name }));
    }

    if (this.isEditing()) {
      this.mutationUpdate.mutate({
        id: this.warehouseId(),
        warehouseLike,
      });
    } else {
      this.mutationCreate.mutate(warehouseLike);
    }
  }
}