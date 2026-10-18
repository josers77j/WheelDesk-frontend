import { Component, computed, inject, input, signal } from '@angular/core';


import { CurrencyPipe, DatePipe } from '@angular/common';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { PurchaseOrder } from '../../interfaces/purchase-order.interface';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

/** Línea de la orden con la zona que le resuelve el preview de zonas. */
interface ProductZoneRow {
  detailId: number;
  productName: string;
  quantity: number;
  /** `Bodega / Zona`; null cuando la línea no tiene zona asignada. */
  zoneLabel: string | null;
}

/** Líneas que caen bajo un mismo encabezado de zona. */
interface ProductZoneGroup {
  key: string;
  label: string;
  rows: ProductZoneRow[];
}

const UNASSIGNED_KEY = 'sin-asignar';
const UNASSIGNED_LABEL = 'Sin asignar';

@Component({
  selector: 'app-quick-view',
  imports: [DatePipe, CurrencyPipe, SkeletonComponent],
  templateUrl: './quick-view.component.html',
})
export class QuickViewComponent {

  order = input<PurchaseOrder | null>(null)

  isCopy = signal<boolean>(false)

  /** Etiqueta de la zona que falta; la comparten filas y encabezado de grupo. */
  readonly unassignedLabel = UNASSIGNED_LABEL;

  purchaseOrderService = inject(PurchaseOrderService);

  /** Id de la orden abierta en vista previa; 0 = todavía no hay ninguna. */
  previewId = computed(() => this.order()?.id ?? 0);

  /**
   * Zonas sugeridas: perezoso, solo pide cuando hay una orden seleccionada
   * para vista previa (al abrir el modal), nunca al montar el componente.
   */
  zonePreviewQuery = injectQuery(() => ({
    queryKey: ['purchase-order-zone-preview', this.previewId()],
    queryFn: () =>
      firstValueFrom(this.purchaseOrderService.getZonePreview(this.previewId())),
    enabled: this.previewId() > 0,
    staleTime: 5000 * 60,
  }));

  zonePreview = computed(() => this.zonePreviewQuery.data() ?? []);

  /**
   * Vista unificada de productos: una fila por línea de la orden con la zona
   * que le sugiere el preview.
   *
   * El preview se casa EXCLUSIVAMENTE por `purchaseOrderDetailId`: es la única
   * clave que identifica la línea. Una orden puede llevar dos líneas del mismo
   * producto, así que casar por `productId` asignaría a la línea equivocada la
   * zona de su gemela. Si ningún `purchaseOrderDetailId` cuadra, la zona queda
   * `null` ("Sin asignar") en vez de adivinarse.
   */
  productRows = computed<ProductZoneRow[]>(() => {
    const details = this.order()?.details ?? [];
    const preview = this.zonePreview();

    return details.map((detail) => {
      const line = preview.find(
        (item) => item.purchaseOrderDetailId === detail.id,
      );
      const label =
        line && line.zoneId !== null
          ? [line.warehouseName, line.zoneName].filter(Boolean).join(' / ')
          : null;

      return {
        detailId: detail.id,
        productName: detail.product.name,
        quantity: detail.quantity,
        zoneLabel: label === '' ? null : label,
      };
    });
  });

  /** ¿Alguna línea tiene zona designada? Decide si la tabla lleva agrupadores. */
  hasAssignedZones = computed(() =>
    this.productRows().some((row) => row.zoneLabel !== null),
  );

  /** Filas agrupadas por zona; el grupo "Sin asignar" siempre va de último. */
  productGroups = computed<ProductZoneGroup[]>(() => {
    const groups = new Map<string, ProductZoneGroup>();

    for (const row of this.productRows()) {
      const key = row.zoneLabel ?? UNASSIGNED_KEY;
      const group = groups.get(key);

      if (group) {
        group.rows.push(row);
        continue;
      }

      groups.set(key, {
        key,
        label: row.zoneLabel ?? UNASSIGNED_LABEL,
        rows: [row],
      });
    }

    return [...groups.values()].sort((a, b) => {
      if (a.key === UNASSIGNED_KEY) return 1;
      if (b.key === UNASSIGNED_KEY) return -1;
      return a.label.localeCompare(b.label, 'es');
    });
  });

  copyText(text: string) {
  this.isCopy.set(true)
  navigator.clipboard.writeText(text);
  setTimeout(() => {
    this.isCopy.set(false)
  }, 2000);
}
}
