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


@Component({
  imports: [FilterPanelComponent],
  template: `<div [style.width.px]="width()">
    <app-filter-panel [hasAdditional]="true" [hasSearch]="hasSearch()">
      <div filterSearch class="filter-label"><span>Buscar por número o nombre</span><input class="input w-full" aria-label="Consulta" /></div>
    </app-filter-panel>
  </div>`,
})
class AlignmentHostComponent {
  readonly width = signal(900);
  readonly hasSearch = signal(true);
}

describe('Filter search and toggle alignment', (): void => {
  it('aligns both controls at the same height while sharing a row', (): void => {
    const fixture = TestBed.createComponent(AlignmentHostComponent);
    for (const width of [900, 600, 500]) {
      fixture.componentInstance.width.set(width);
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      // Karma does not expand Tailwind utilities; keep the production focus gutter.
      root.querySelectorAll<HTMLElement>('.filter-panel-main > .p-1').forEach(element => { element.style.padding = '4px'; });
      const input = root.querySelector<HTMLInputElement>('input[aria-label="Consulta"]');
      const button = root.querySelector<HTMLButtonElement>('button[aria-expanded]');
      if (!input || !button) throw new Error('Expected filter controls');
      const searchBounds = input.getBoundingClientRect();
      const buttonBounds = button.getBoundingClientRect();
      expect(searchBounds.height).toBeGreaterThan(0);
      expect(Math.abs(searchBounds.top - buttonBounds.top)).withContext('top at width ' + width).toBeLessThanOrEqual(1);
      expect(Math.abs(searchBounds.bottom - buttonBounds.bottom)).withContext('bottom at width ' + width).toBeLessThanOrEqual(1);
    }
  });
  it('keeps the toggle on its own row and inside the panel on narrow screens', (): void => {
    const fixture = TestBed.createComponent(AlignmentHostComponent);
    fixture.componentInstance.width.set(360);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const input = root.querySelector<HTMLInputElement>('input[aria-label="Consulta"]');
    const button = root.querySelector<HTMLButtonElement>('button[aria-expanded]');
    const panel = root.querySelector<HTMLElement>('.filter-panel');
    if (!input || !button || !panel) throw new Error('Expected filter controls');
    const bounds = button.getBoundingClientRect();
    expect(bounds.top).toBeGreaterThanOrEqual(input.getBoundingClientRect().bottom);
    expect(bounds.right).toBeLessThanOrEqual(panel.getBoundingClientRect().right);
  });
});
