import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { FilterPanelComponent } from './filter-panel.component';

@Component({
  imports: [FilterPanelComponent, ReactiveFormsModule],
  template: `<form (submit)="$event.preventDefault(); submits = submits + 1">
    <app-filter-panel [hasAdditional]="additional()" [expanded]="expanded()" (expandedChange)="expanded.set($event)">
      <input filterSearch aria-label="Buscar" />
      <div filterFields><input aria-label="Periodo" [formControl]="period" /></div>
      <div filterActions><button type="submit">Buscar registros</button></div>
    </app-filter-panel>
  </form>`,
})
class HostComponent {
  readonly additional = signal(true);
  readonly expanded = signal(true);
  readonly period = new FormControl('2026-10', { nonNullable: true });
  submits = 0;
}

describe('Shared filter panel', (): void => {
  it('collapses without submitting, destroying fields or clearing their values', (): void => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host: unknown = fixture.nativeElement;
    if (!(host instanceof HTMLElement)) throw new Error('Expected host');
    const toggle = host.querySelector('button[aria-expanded]');
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('Expected filter toggle');
    const input = host.querySelector('input[aria-label="Periodo"]');
    toggle.click(); fixture.detectChanges();
    expect(fixture.componentInstance.submits).toBe(0);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const expansion = host.querySelector<HTMLElement>('.filter-panel-expansion');
    expect(expansion?.classList.contains('filter-panel-expanded')).toBeFalse();
    expect(expansion?.hasAttribute('inert')).toBeTrue();
    expect(expansion?.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('input[aria-label="Periodo"]')).toBe(input);
    expect(fixture.componentInstance.period.value).toBe('2026-10');
    toggle.click(); fixture.detectChanges();
    expect(expansion?.classList.contains('filter-panel-expanded')).toBeTrue();
    expect(expansion?.hasAttribute('inert')).toBeFalse();
    expect(expansion?.getAttribute('aria-hidden')).toBe('false');
    expect(toggle.textContent).toContain('Filtros');
    fixture.destroy();
  });

  it('keeps the main search visible and omits the toggle when there are no additional filters', (): void => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.additional.set(false);
    fixture.detectChanges();
    const host: unknown = fixture.nativeElement;
    if (!(host instanceof HTMLElement)) throw new Error('Expected host');
    expect(host.querySelector('button[aria-expanded]')).toBeNull();
    expect(host.querySelector('input[aria-label="Buscar"]')).not.toBeNull();
    fixture.destroy();
  });
});
