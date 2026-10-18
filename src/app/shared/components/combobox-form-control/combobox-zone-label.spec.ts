import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ValueParams } from '../combobox/interfaces/search-param.interface';
import { ComboboxFormControlComponent } from './combobox-form-control.component';

@Component({
  imports: [ComboboxFormControlComponent],
  template: `<app-combobox-form-control namePrefixSeparator=" / " placeholderInput="zona"
    [valuesResource]="values" [selectedValue]="selected()" (valuesOutput)="selected.set($event)" />
    <app-combobox-form-control placeholderInput="otro" [valuesResource]="values" [selectedValue]="selected()" />`,
})
class ZoneLabelHostComponent {
  readonly values: ValueParams[] = [{ id: 8, name: 'Bodega Norte / Zona A' }];
  readonly selected = signal<ValueParams | null>(this.values[0]);
}

describe('Zone combobox labels', (): void => {
  let fixture: ComponentFixture<ZoneLabelHostComponent>;

  beforeEach((): void => {
    TestBed.configureTestingModule({ imports: [ZoneLabelHostComponent] });
    fixture = TestBed.createComponent(ZoneLabelHostComponent);
    fixture.detectChanges();
  });

  function host(index: number): HTMLElement {
    return fixture.debugElement.queryAll(By.directive(ComboboxFormControlComponent))[index].nativeElement;
  }

  it('shows only the zone in the selected label', (): void => {
    expect(host(0).querySelector('button span')?.textContent?.trim()).toBe('Zona A');
  });

  it('shows only the zone in the available options', (): void => {
    expect(host(0).querySelector('li a')?.textContent?.trim()).toBe('Zona A');
  });

  it('preserves the selected ID and full name used by stock matching', (): void => {
    const component = fixture.debugElement.queryAll(By.directive(ComboboxFormControlComponent))[0]
      .injector.get(ComboboxFormControlComponent);
    component.setValue(fixture.componentInstance.values[0]);
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toEqual({ id: 8, name: 'Bodega Norte / Zona A' });
  });

  it('preserves names in ordinary comboboxes', (): void => {
    expect(host(1).querySelector('li a')?.textContent?.trim()).toBe('Bodega Norte / Zona A');
  });
  for (const key of ['Enter', ' ']) {
    it(`selects once and closes the panel with ${key === ' ' ? 'Space' : key}`, (): void => {
      const component = fixture.debugElement.queryAll(By.directive(ComboboxFormControlComponent))[0]
        .injector.get(ComboboxFormControlComponent);
      const emit = spyOn(component.valuesOutput, 'emit').and.callThrough();
      component.toggleDropdown();
      fixture.detectChanges();
      const option = document.querySelector<HTMLElement>('div.menu:not([hidden]) li a[role="button"]');
      if (!option) throw new Error('Expected a focusable option in the portaled panel');
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      option.dispatchEvent(event);
      fixture.detectChanges();
      expect(emit).toHaveBeenCalledOnceWith(fixture.componentInstance.values[0]);
      expect(event.defaultPrevented).toBeTrue();
      expect(component.isOpen()).toBeFalse();
    });
  }

  it('clears without reopening the dropdown and keeps the clear button outside the trigger', (): void => {
    const component = fixture.debugElement.queryAll(By.directive(ComboboxFormControlComponent))[0]
      .injector.get(ComboboxFormControlComponent);
    const clear = host(0).querySelector<HTMLButtonElement>('button[aria-label="Limpiar selección"]');
    if (!clear) throw new Error('Expected the clear selection button');
    expect(clear.closest('button.input')).toBeNull();
    clear.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBeNull();
    expect(component.isOpen()).toBeFalse();
  });

});
