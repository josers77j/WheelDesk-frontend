import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ProductEntryLayoutComponent } from './product-entry-layout.component';

@Component({
  imports: [ProductEntryLayoutComponent, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()">
      <app-product-entry-layout title="Agregar producto" (closed)="closed = true">
        <div productSelection><select formControlName="productId" aria-label="Producto"><option [ngValue]="1">Producto de prueba</option></select></div>
        <div productFields><input type="number" formControlName="quantity" aria-label="Cantidad" /></div>
        <div productActions><button type="submit">Guardar</button></div>
      </app-product-entry-layout>
    </form>`,
})
class EntryHostComponent {
  readonly form = new FormGroup({ productId: new FormControl(1), quantity: new FormControl(1) });
  submitted: { productId: number | null; quantity: number | null } | null = null;
  closed = false;
  save(): void { this.submitted = this.form.getRawValue(); }
}

describe('Product entry layout form integration', (): void => {
  it('keeps projected controls and submit attached to the parent form', (): void => {
    const fixture = TestBed.createComponent(EntryHostComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const input = element.querySelector<HTMLInputElement>('input');
    if (!input) throw new Error('Missing quantity input');
    input.value = '4';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    element.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    expect(fixture.componentInstance.submitted).toEqual({productId: 1, quantity: 4});
  });

  it('closes without submitting the parent form', (): void => {
    const fixture = TestBed.createComponent(EntryHostComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('button[aria-label="Cerrar producto"]')?.click();
    expect(fixture.componentInstance.closed).toBeTrue();
    expect(fixture.componentInstance.submitted).toBeNull();
  });
});
