import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComboboxComponent } from './combobox.component';

describe('ComboboxComponent selection interactions', (): void => {
  let fixture: ComponentFixture<ComboboxComponent>;
  const value = { id: 8, name: 'QA option' };

  beforeEach((): void => {
    TestBed.configureTestingModule({ imports: [ComboboxComponent] });
    fixture = TestBed.createComponent(ComboboxComponent);
    fixture.componentRef.setInput('valuesResource', [value]);
    fixture.componentRef.setInput('placeholderInput', 'opción');
    fixture.detectChanges();
  });

  function openOption(): HTMLElement {
    fixture.componentInstance.toggleDropdown();
    fixture.detectChanges();
    const option = document.querySelector<HTMLElement>('div.menu:not([hidden]) li a[role="button"]');
    if (!option) throw new Error('Expected an option in the open panel');
    return option;
  }

  for (const key of ['Enter', ' ']) {
    it(`selects exactly once with ${key === ' ' ? 'Space' : key}`, (): void => {
      const emit = spyOn(fixture.componentInstance.valuesOutput, 'emit');
      const option = openOption();
      option.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      fixture.detectChanges();
      expect(emit).toHaveBeenCalledOnceWith(value);
      expect(fixture.componentInstance.isOpen()).toBeFalse();
    });
  }

  it('preserves pointer selection without duplicate emissions', (): void => {
    const emit = spyOn(fixture.componentInstance.valuesOutput, 'emit');
    const option = openOption();
    option.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    option.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
    option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(emit).toHaveBeenCalledOnceWith(value);
    expect(fixture.componentInstance.isOpen()).toBeFalse();
  });

  it('clears without activating the dropdown trigger', (): void => {
    fixture.componentRef.setInput('selectedValue', value);
    fixture.detectChanges();
    const emit = spyOn(fixture.componentInstance.valuesOutput, 'emit');
    const clear = fixture.nativeElement.querySelector('button[aria-label="Limpiar selección"]');
    if (!(clear instanceof HTMLButtonElement)) throw new Error('Expected the clear button');
    clear.click();
    fixture.detectChanges();
    expect(emit).toHaveBeenCalledOnceWith(null);
    expect(fixture.componentInstance.isOpen()).toBeFalse();
  });
});
