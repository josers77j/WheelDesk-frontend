import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { listSelectionNumber } from './list-selection';

describe('List selection', (): void => {
  it('shows the row number including the page offset instead of the database ID', (): void => {
    const selected = signal(0);
    const page = signal(2);
    const number = TestBed.runInInjectionContext(() => listSelectionNumber(selected, page, () => ({ data: [{ id: 980 }, { id: 456 }], meta: { page: 2, limit: 10 } })));
    TestBed.flushEffects();
    selected.set(456);
    expect(number()).toBe(12);
    expect(selected()).toBe(456);
    selected.set(999);
    expect(number()).toBe(0);
  });

  it('clears selection on a page change and does not restore it when returning', (): void => {
    const selected = signal(980);
    const page = signal(1);
    TestBed.runInInjectionContext(() => listSelectionNumber(selected, page, () => undefined));
    TestBed.flushEffects();
    selected.set(980);
    TestBed.flushEffects();
    expect(selected()).toBe(980);
    page.set(2);
    TestBed.flushEffects();
    expect(selected()).toBe(0);
    page.set(1);
    TestBed.flushEffects();
    expect(selected()).toBe(0);
    selected.set(980);
    TestBed.resetTestingModule();
    expect(selected()).toBe(0);
  });
});
