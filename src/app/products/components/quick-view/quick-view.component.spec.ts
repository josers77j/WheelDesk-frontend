import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { QuickViewComponent } from './quick-view.component';
import { emptyProduct } from '../../services/product.service';
import { CONSTRUCTION, TIRE_CONDITION, TIRE_QUALITY } from '../../interfaces/product.interface';

describe('Product quickview layout A', () => {
  it('shows prepared attributes and the purchase subtotal without stock or a catalog request', () => {
    const fixture = TestBed.createComponent(QuickViewComponent);
    fixture.componentRef.setInput('draft', true);
    fixture.componentRef.setInput('purchaseContext', { quantity: 2, unitPrice: '52' });
    fixture.componentRef.setInput('product', {
      ...emptyProduct, name: '205/55R16 DUNLOP', type: 'TIRE', salePrice: '65', purchasePrice: '52',
      brand: { id: 5, name: 'DUNLOP' }, notes: 'Lote especial',
      itemTypeCatalog: { id: 1, name: 'Bienes' }, unitOfMeasureCatalog: { id: 59, name: 'Unidad' },
      tire: { prefix: '', width: 205, aspectRatio: 55, rimDiameter: '16', construction: CONSTRUCTION.RADIAL,
        condition: TIRE_CONDITION.NEW, quality: TIRE_QUALITY.A, loadIndexFront: 91, loadIndexRear: null,
        speedRating: 'W', loadRange: '', plies: null, vehicleTypeId: [] },
    });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('todavía no tiene existencias');
    expect(text).toContain('Unidad');
    expect(text).toContain('Bienes');
    expect(text).toContain('Lote especial');
    expect(text).toContain('Índice de carga delantero');
    expect(text).not.toContain('Stock por zona');
    expect(text).not.toContain('Cantidad disponible');
    expect(fixture.componentInstance.purchaseSubtotal()).toBe('104.0000');
    expect(fixture.debugElement.query(By.css('footer button'))).not.toBeNull();
    fixture.destroy();
  });
  it('keeps inventory and the collapsible purchase price for a catalog product', () => {
    const fixture = TestBed.createComponent(QuickViewComponent);
    fixture.componentRef.setInput('product', { ...emptyProduct, type: 'SUPPLY', name: 'Insumo', stock: 0, purchasePrice: '10', salePrice: '20' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cantidad disponible');
    expect(fixture.nativeElement.textContent).toContain('Stock por zona');
    expect(fixture.nativeElement.textContent).not.toContain('todavía no tiene existencias');
    const details = fixture.debugElement.query(By.css('details'));
    expect(details.nativeElement.open).toBeFalse();
    expect(fixture.debugElement.query(By.css('[aria-label="Cerrar al tocar fuera"]'))).not.toBeNull();
    fixture.destroy();
  });
});
