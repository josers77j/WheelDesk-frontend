import { CurrencyPipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  injectMutation,
  injectQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { ComboboxFormControlComponent } from '../../../shared/components/combobox-form-control/combobox-form-control.component';
import { ValueParams } from '../../../shared/components/combobox/interfaces/search-param.interface';
import { ZoneService } from '../../../zones/services/zone.service';
import { WarehouseService } from '../../../warehouses/services/warehouse.service';
import { ConfirmActionModalComponent } from '../../../shared/components/confirm-action-modal/confirm-action-modal.component';
import {
  ConfirmPurchaseOrderDetail,
  PurchaseOrder,
} from '../../interfaces/purchase-order.interface';
import { invalidateCatalogCaches } from '../../../shared/utils/invalidate-catalog-caches.util';

interface AllocationRow {
  warehouse: ValueParams | null;
  zone: ValueParams | null;
  quantity: number;
}

/** Zonas ya filtradas por bodega: pinta solo el nombre (sin "Bodega / ..."). */
function stripWarehousePrefix(name: string): string {
  const parts = name.split(' / ');
  return parts.length > 1 ? parts[parts.length - 1].trim() : name;
}

interface ApproveLine {
  detailId: number;
  productName: string;
  quantity: number;
  suggestedZoneName: string | null;
  allocations: AllocationRow[];
}

@Component({
  selector: 'app-approve-modal',
  imports: [FormsModule, CurrencyPipe, ComboboxFormControlComponent, ConfirmActionModalComponent],
  templateUrl: './approve-modal.component.html',
})
export class ApproveModalComponent {
  order = input.required<PurchaseOrder | null>();

  approved = output<void>();
  dismissed = output<void>();

  purchaseOrderService = inject(PurchaseOrderService);
  zoneService = inject(ZoneService);
  warehouseService = inject(WarehouseService);
  alertService = inject(AlertService);
  queryClient = inject(QueryClient);

  approveDialog = viewChild<ElementRef<HTMLDialogElement>>('approveModal');
  approveConfirmModal = viewChild(ConfirmActionModalComponent);

  /** Resumen para la puerta de confirmación: la aprobación ingresa stock. */
  approveSummaryMessage = computed(() => {
    const order = this.order();
    return (
      `Orden #${order?.documentNumber ?? ''} | Proveedor: ${order?.provider?.name ?? ''} | ` +
      `Líneas: ${this.lines().length} | Total: $${order?.total ?? '0'}. ` +
      `El stock ingresará a las zonas asignadas y no se puede deshacer. ¿Confirmar aprobación?`
    );
  });

  lines = signal<ApproveLine[]>([]);
  limit = 5;

  // Cascada bodega → zona (patrón checkout de ventas / modal de compras).
  warehouseComboboxOutput = signal<string>('');
  /** Perezoso: bodegas al interactuar con su combobox (no al abrir). */
  warehouseTouched = signal(false);
  zoneComboboxOutput = signal<string>('');
  /** Perezoso: zonas al interactuar con su combobox (no al abrir). */
  zoneTouched = signal(false);
  /** Fila que tiene el foco: su bodega filtra la query de zonas. */
  activeRow = signal<{ li: number; ri: number } | null>(null);

  warehousesQuery = injectQuery(() => ({
    queryKey: ['warehouse-combobox-approve', this.warehouseComboboxOutput()],
    queryFn: () =>
      firstValueFrom(
        this.warehouseService.searchWarehousesByName(
          this.limit,
          this.warehouseComboboxOutput(),
        ),
      ),
    staleTime: 5000 * 60,
    // Perezoso: el modal vive montado; pide al interactuar, no al abrir.
    enabled: this.warehouseTouched(),
  }));

  activeWarehouseId = computed(() => {
    const active = this.activeRow();
    if (!active) return null;
    return (
      this.lines()[active.li]?.allocations[active.ri]?.warehouse?.id ?? null
    );
  });

  zonesQuery = injectQuery(() => ({
    queryKey: [
      'zone-combobox-approve',
      this.zoneComboboxOutput(),
      this.activeWarehouseId(),
    ],
    queryFn: () =>
      firstValueFrom(
        this.zoneService.getZonesByName(
          this.limit,
          this.zoneComboboxOutput(),
          undefined,
          this.activeWarehouseId() ?? undefined,
        ),
      ),
    staleTime: 5000 * 60,
    // Perezoso + cascada: sin bodega elegida en la fila activa no hay zonas.
    enabled: this.zoneTouched() && this.activeWarehouseId() !== null,
  }));

  /** Zonas filtradas por bodega: solo nombre, sin prefijo "Bodega / ...". */
  filteredZoneOptions = computed(() => {
    if (this.activeWarehouseId() === null) return [];
    return (this.zonesQuery.data() ?? []).map((zone) => ({
      id: zone.id,
      name: stripWarehousePrefix(zone.name),
    }));
  });

  syncEffect = effect(() => {
    const order = this.order();
    if (!order) {
      this.lines.set([]);
      // La fila activa puede apuntar a una orden anterior: se resetea.
      this.activeRow.set(null);
      this.warehouseTouched.set(false);
      this.zoneTouched.set(false);
      this.warehouseComboboxOutput.set('');
      this.zoneComboboxOutput.set('');
      return;
    }
    this.lines.set(
      order.details.map((detail) => ({
        detailId: detail.id,
        productName: detail.product.name,
        quantity: detail.quantity,
        suggestedZoneName: detail.suggestedZone
          ? `${detail.suggestedZone.warehouse.name} / ${detail.suggestedZone.name}`
          : null,
        allocations: [
          detail.suggestedZoneId
            ? {
                warehouse: detail.suggestedZone
                  ? {
                      id: detail.suggestedZone.warehouse.id,
                      name: detail.suggestedZone.warehouse.name,
                    }
                  : null,
                zone: {
                  id: detail.suggestedZoneId,
                  name: detail.suggestedZone
                    ? stripWarehousePrefix(detail.suggestedZone.name)
                    : '',
                },
                quantity: detail.quantity,
              }
            : { warehouse: null, zone: null, quantity: detail.quantity },
        ],
      })),
    );
    // La fila activa puede apuntar a una orden anterior: se resetea.
    this.activeRow.set(null);
    this.warehouseTouched.set(false);
    this.zoneTouched.set(false);
    this.warehouseComboboxOutput.set('');
    this.zoneComboboxOutput.set('');
  });

  lineAllocated = (line: ApproveLine): number =>
    line.allocations.reduce((acc, row) => acc + (+row.quantity || 0), 0);

  lineValid = (line: ApproveLine): boolean =>
    line.allocations.length > 0 &&
    line.allocations.every(
      (row) =>
        (row.warehouse?.id ?? 0) > 0 &&
        (row.zone?.id ?? 0) > 0 &&
        +row.quantity >= 1,
    ) &&
    this.lineAllocated(line) === line.quantity;

  allValid = computed(() => {
    const lines = this.lines();
    return lines.length > 0 && lines.every((line) => this.lineValid(line));
  });

  onWarehouseFocus(lineIndex: number, rowIndex: number) {
    this.activeRow.set({ li: lineIndex, ri: rowIndex });
    this.warehouseTouched.set(true);
  }

  onZoneFocus(lineIndex: number, rowIndex: number) {
    this.activeRow.set({ li: lineIndex, ri: rowIndex });
    this.zoneTouched.set(true);
  }

  setAllocationWarehouse(
    lineIndex: number,
    rowIndex: number,
    warehouse: ValueParams | null,
  ) {
    const current =
      this.lines()[lineIndex]?.allocations[rowIndex]?.warehouse ?? null;
    if ((current?.id ?? null) === (warehouse?.id ?? null)) {
      // Misma bodega: solo refresca la fila activa sin limpiar la zona.
      this.activeRow.set({ li: lineIndex, ri: rowIndex });
      return;
    }
    this.lines.update((lines) =>
      lines.map((line, li) =>
        li !== lineIndex
          ? line
          : {
              ...line,
              allocations: line.allocations.map((row, ri) =>
                ri !== rowIndex
                  ? row
                  : { ...row, warehouse, zone: null },
              ),
            },
      ),
    );
    this.activeRow.set({ li: lineIndex, ri: rowIndex });
  }

  setAllocationZone(lineIndex: number, rowIndex: number, zone: ValueParams | null) {
    this.lines.update((lines) =>
      lines.map((line, li) =>
        li !== lineIndex
          ? line
          : {
              ...line,
              allocations: line.allocations.map((row, ri) =>
                ri !== rowIndex
                  ? row
                  : {
                      ...row,
                      zone: zone
                        ? {
                            id: zone.id,
                            name: stripWarehousePrefix(zone.name),
                          }
                        : null,
                    },
              ),
            },
      ),
    );
  }

  setAllocationQuantity(lineIndex: number, rowIndex: number, quantity: number) {
    this.lines.update((lines) =>
      lines.map((line, li) =>
        li !== lineIndex
          ? line
          : {
              ...line,
              allocations: line.allocations.map((row, ri) =>
                ri !== rowIndex ? row : { ...row, quantity },
              ),
            },
      ),
    );
  }

  addAllocation(lineIndex: number) {
    this.lines.update((lines) =>
      lines.map((line, li) =>
        li !== lineIndex
          ? line
          : {
              ...line,
              allocations: [
                ...line.allocations,
                { warehouse: null, zone: null, quantity: 1 },
              ],
            },
      ),
    );
  }

  removeAllocation(lineIndex: number, rowIndex: number) {
    this.lines.update((lines) =>
      lines.map((line, li) =>
        li !== lineIndex
          ? line
          : {
              ...line,
              allocations: line.allocations.filter((_, ri) => ri !== rowIndex),
            },
      ),
    );
  }

  openModal() {
    this.approveDialog()?.nativeElement.showModal();
  }

  closeModal(notify = true): void {
    this.approveDialog()?.nativeElement.close();
    if (notify) this.dismissed.emit();
  }

  mutationApprove = injectMutation(() => ({
    mutationFn: (vars: { id: number; details: ConfirmPurchaseOrderDetail[] }) =>
      firstValueFrom(
        this.purchaseOrderService.approvePurchaseOrder(vars.id, vars.details),
      ),
    onSuccess: () => {
      this.queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      // El preview de zonas se cachea por orden (`staleTime` 5min): sin
      // reventarlo, la vista previa sigue pintando las zonas anteriores.
      this.queryClient.invalidateQueries({
        queryKey: ['purchase-order-zone-preview'],
      });
      this.queryClient.invalidateQueries({ queryKey: ['supplies'] });
      invalidateCatalogCaches(this.queryClient);
      this.queryClient.invalidateQueries({ queryKey: ['tires'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Orden aprobada con éxito');
      this.closeModal(false);
      this.approved.emit();
    },
    onError: (exception) => {
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  onConfirmApprove() {
    const order = this.order();
    if (!order) return;
    if (!this.allValid()) {
      this.alertService.showError(
        'Cada línea debe repartir su cantidad exacta entre zonas válidas',
      );
      return;
    }
    // Puerta de confirmación: cancelar no aprueba nada; el payload no cambia.
    this.approveConfirmModal()?.open();
  }

  onApproveConfirmed() {
    const order = this.order();
    if (!order || !this.allValid()) return;
    const details: ConfirmPurchaseOrderDetail[] = this.lines().map((line) => ({
      purchaseOrderDetailId: line.detailId,
      allocations: line.allocations.map((row) => ({
        zoneId: row.zone!.id,
        quantity: +row.quantity,
      })),
    }));
    this.mutationApprove.mutate({ id: order.id, details });
  }
}
