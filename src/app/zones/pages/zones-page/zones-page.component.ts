import { FilterPanelComponent } from '../../../shared/components/filter-panel/filter-panel.component';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { ZoneService } from '../../services/zone.service';
import { WarehouseService } from '../../../warehouses/services/warehouse.service';
import { Zone } from '../../../warehouses/interfaces/warehouse.interface';
import { ComboboxFormControlComponent } from '../../../shared/components/combobox-form-control/combobox-form-control.component';
import { ValueParams } from '../../../shared/components/combobox/interfaces/search-param.interface';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ConfirmActionModalComponent } from '../../../shared/components/confirm-action-modal/confirm-action-modal.component';
import { TitleComponent } from '../../../shared/components/title/title.component';

@Component({ selector: 'app-zones-page', imports: [
    FilterPanelComponent,ReactiveFormsModule, RouterLink, ComboboxFormControlComponent, ConfirmActionModalComponent, TitleComponent], templateUrl: './zones-page.component.html' })
export class ZonesPageComponent {
  private readonly api = inject(ZoneService);
  private readonly warehouses = inject(WarehouseService);
  private readonly alerts = inject(AlertService);
  private readonly auth = inject(AuthService);
  private readonly cache = inject(QueryClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly confirm = viewChild(ConfirmActionModalComponent);
  readonly warehouseId = signal(this.initialWarehouse());
  readonly warehouseSearch = signal('');
  readonly zoneSearch = signal('');
  readonly filter = new FormControl('', { nonNullable: true });
  readonly page = signal(1);
  readonly productPage = signal(1);
  readonly selected = signal<Zone | null>(null);
  readonly editing = signal<Zone | null>(null);
  readonly deleting = signal<Zone | null>(null);
  readonly busy = signal(false);
  readonly attempted = signal(false);
  readonly name = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  readonly canWrite = computed(() => ['ADMIN', 'SELLER'].includes(this.auth.user()?.role ?? ''));
  readonly warehouseQuery = injectQuery(() => ({ queryKey: ['warehouse-zones-header', this.warehouseId()], enabled: this.warehouseId() > 0, queryFn: () => firstValueFrom(this.warehouses.getWarehouseById(this.warehouseId())) }));
  readonly warehouseOptions = injectQuery(() => ({ queryKey: ['warehouse-zones-search', this.warehouseSearch()], queryFn: () => firstValueFrom(this.warehouses.searchWarehousesByName(30, this.warehouseSearch())), staleTime: 60_000 }));
  readonly zones = injectQuery(() => ({ queryKey: ['warehouse-zones', this.warehouseId(), this.page(), this.zoneSearch()], enabled: this.warehouseId() > 0, queryFn: () => firstValueFrom(this.api.list(this.warehouseId(), this.page(), this.zoneSearch())) }));
  readonly products = injectQuery(() => ({ queryKey: ['zone-products', this.selected()?.id, this.productPage()], enabled: !!this.selected(), queryFn: () => firstValueFrom(this.api.products(this.selected()?.id ?? 0, this.productPage())) }));
  private initialWarehouse(): number { const id = Number(this.route.snapshot.queryParamMap.get('warehouseId')); return Number.isSafeInteger(id) && id > 0 ? id : 0; }
  chooseWarehouse(value: ValueParams | null): void {
    if (this.busy()) return;
    this.warehouseId.set(value?.id ?? 0); this.page.set(1); this.selected.set(null); this.productPage.set(1); this.zoneSearch.set(''); this.filter.reset(); this.cancelEdit();
    void this.router.navigate([], { relativeTo: this.route, queryParams: { warehouseId: value?.id ?? null }, replaceUrl: true });
  }
  search(): void { if (this.zones.isFetching()) return; this.zoneSearch.set(this.filter.value.trim()); this.page.set(1); this.selected.set(null); this.productPage.set(1); }
  select(zone: Zone): void { if (!this.busy()) { this.selected.set(zone); this.productPage.set(1); } }
  edit(zone: Zone): void { if (this.busy()) return; this.editing.set(zone); this.name.setValue(zone.name); this.attempted.set(false); }
  cancelEdit(): void { this.editing.set(null); this.name.reset(); this.attempted.set(false); }
  async save(): Promise<void> {
    if (this.busy() || !this.canWrite() || !this.warehouseId()) return;
    this.attempted.set(true); const name = this.name.value.trim(); if (!name) return;
    this.busy.set(true);
    try {
      const editing = this.editing();
      await firstValueFrom(editing ? this.api.update(editing.id, name) : this.api.create(this.warehouseId(), name));
      this.cancelEdit(); this.alerts.showSuccess(editing ? 'Zona actualizada correctamente.' : 'Zona creada correctamente.');
      if (editing?.id === this.selected()?.id) this.selected.update(zone => zone ? { ...zone, name } : null);
      await this.refresh();
    } catch (error: unknown) { this.alerts.showError(this.message(error)); }
    finally { this.busy.set(false); }
  }
  askDelete(zone: Zone): void { if (!this.busy() && this.canWrite()) { this.deleting.set(zone); this.confirm()?.open(); } }
  async remove(): Promise<void> {
    const zone = this.deleting(); if (!zone || this.busy() || !this.canWrite()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteZone(zone.id));
      if (this.selected()?.id === zone.id) this.selected.set(null);
      if (this.editing()?.id === zone.id) this.cancelEdit();
      this.alerts.showSuccess('Zona eliminada correctamente.');
      if ((this.zones.data()?.data.length ?? 0) === 1 && this.page() > 1) this.page.update(page => page - 1);
      await this.refresh();
    } catch (error: unknown) { this.alerts.showError(this.message(error)); }
    finally { this.busy.set(false); this.deleting.set(null); }
  }
  private async refresh(): Promise<void> {
    await Promise.all([this.cache.invalidateQueries({ queryKey: ['warehouse-zones', this.warehouseId()] }), this.cache.invalidateQueries({ queryKey: ['warehouses'] }), this.cache.invalidateQueries({ queryKey: ['warehouse-zones-header', this.warehouseId()] })]);
  }
  private message(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object' && 'message' in error.error) { const message: unknown = error.error.message; if (typeof message === 'string') return message; if (Array.isArray(message)) return message.filter((item): item is string => typeof item === 'string').join('\n'); }
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message; return 'No se pudo completar la operación. Intente nuevamente.'; }
}
