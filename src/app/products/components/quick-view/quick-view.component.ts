import { Component, computed, DestroyRef, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import Decimal from 'decimal.js';
import { Product, ProductVehicleType, ProductZoneStockItem } from '../../interfaces/product.interface';
import { TireConditionPipe } from '../../pipes/tire-condition.pipe';
import { ConstructionPipe } from '../../pipes/construction.pipe';
import { LoadRangePipe } from '../../pipes/load-range.pipe';

interface ProductField { label: string; value: string; }

@Component({
  selector: 'app-quick-view',
  imports: [CurrencyPipe],
  templateUrl: './quick-view.component.html',
})
export class QuickViewComponent {
  readonly dialogId = input('my_modal_3');
  readonly draft = input(false);
  readonly purchaseContext = input<{ quantity: number; unitPrice: string } | null>(null);
  readonly product = input<Product | null>(null);
  readonly isCopy = signal(false);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('productDialog');
  private copyTimer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      if (this.copyTimer) clearTimeout(this.copyTimer);
    });
  }
  openModal(): void { this.dialog()?.nativeElement.showModal(); }
  readonly purchaseSubtotal = computed(() => {
    const context = this.purchaseContext();
    if (!context?.unitPrice) return null;
    try { return new Decimal(context.unitPrice).times(context.quantity).toFixed(4); }
    catch { return null; }
  });
  readonly generalFields = computed<ProductField[]>(() => {
    const product = this.product();
    const type = product?.type;
    const tax = product?.taxType;
    const fields: ProductField[] = [
      { label: 'Tipo de producto', value: type === 'TIRE' ? 'Llanta' : type === 'SUPPLY' ? 'Insumo' : type === 'SERVICE' ? 'Servicio' : '—' },
      { label: 'Tipo de ítem', value: this.display(product?.itemTypeCatalog?.name) },
      { label: 'Unidad de medida', value: this.display(product?.unitOfMeasureCatalog?.name) },
      { label: 'Tratamiento tributario', value: tax === 'TAXABLE' ? 'Gravado (IVA)' : tax === 'EXEMPT' ? 'Exento' : tax === 'NON_TAXABLE' ? 'No sujeto' : '—' },
    ];
    if (type !== 'SERVICE') fields.unshift(
      { label: 'Marca', value: this.display(product?.brand?.name) },
      { label: 'Proveedor del producto', value: product?.provider?.name || 'Sin proveedor' },
    );
    if (product?.tire) fields.push(
      { label: 'Condición', value: new TireConditionPipe().transform(product.tire.condition) },
      { label: 'Calidad', value: this.display(product.tire.quality) },
    );
    return fields;
  });
  readonly technicalFields = computed<ProductField[]>(() => {
    const tire = this.product()?.tire;
    if (!tire) return [];
    return [
      { label: 'Ancho', value: tire.width ? `${tire.width} mm` : '—' },
      { label: 'Perfil', value: this.display(tire.aspectRatio) },
      { label: 'Rin', value: tire.rimDiameter ? `${tire.rimDiameter} pulgadas` : '—' },
      { label: 'Construcción', value: new ConstructionPipe().transform(tire.construction) || '—' },
      { label: 'Prefijo', value: this.display(tire.prefix) },
      { label: 'Índice de carga delantero', value: this.display(tire.loadIndexFront) },
      { label: 'Índice de carga trasero', value: this.display(tire.loadIndexRear) },
      { label: 'Velocidad', value: this.display(tire.speedRating) },
      { label: 'Rango de carga', value: new LoadRangePipe().transform(tire.loadRange) || '—' },
      { label: 'Lonas', value: this.display(tire.plies) },
    ];
  });
  private display(value: string | number | null | undefined): string {
    return value === null || value === undefined || value === '' ? '—' : String(value);
  }
  async copyText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      if (this.destroyed) return;
      this.isCopy.set(true);
      if (this.copyTimer) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.isCopy.set(false), 2000);
    } catch { if (!this.destroyed) this.isCopy.set(false); }
  }
  get vehicleTypes(): ProductVehicleType[] { return this.product()?.productVehicleType ?? []; }
  get zoneStocks(): ProductZoneStockItem[] { return this.product()?.ProductZoneStock ?? []; }
}
