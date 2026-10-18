import { computed, DestroyRef, effect, inject, Signal, untracked, WritableSignal } from '@angular/core';

interface SelectionPage {
  data: readonly { id: number }[];
  meta: { page: number; limit: number };
}

export function listSelectionNumber(
  selected: WritableSignal<number>,
  page: Signal<number>,
  response: () => SelectionPage | undefined,
): Signal<number> {
  effect((): void => {
    page();
    untracked((): void => selected.set(0));
  });
  inject(DestroyRef).onDestroy((): void => selected.set(0));
  return computed((): number => {
    const data = response();
    if (!data) return 0;
    const index = data.data.findIndex((row): boolean => row.id === selected());
    return index < 0 ? 0 : (data.meta.page - 1) * data.meta.limit + index + 1;
  });
}
