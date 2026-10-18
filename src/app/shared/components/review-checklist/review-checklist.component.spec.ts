import { TestBed } from '@angular/core/testing';
import { ReviewChecklistComponent } from './review-checklist.component';

describe('Review checklist status', () => {
  it('distinguishes completed, untouched, required and optional fields', () => {
    const fixture = TestBed.createComponent(ReviewChecklistComponent);
    fixture.componentRef.setInput('items', [
      { label: 'Completo', complete: true, touched: true },
      { label: 'Pendiente', complete: false, touched: false },
      { label: 'Requerido', complete: false, touched: true },
      { label: 'Opcional', complete: false, touched: true, optional: true },
    ]); fixture.detectChanges();
    const host: unknown = fixture.nativeElement; if (!(host instanceof HTMLElement)) throw new Error('Expected checklist host');
    const items = host.querySelectorAll('li');
    expect(items[0].classList.contains('text-success')).toBeTrue();
    expect(items[1].textContent).toContain('Sin completar');
    expect(items[2].classList.contains('text-error')).toBeTrue();
    expect(items[3].classList.contains('text-error')).toBeFalse();
    expect(items[3].textContent).toContain('Opcional, sin agregar');
  });
});
