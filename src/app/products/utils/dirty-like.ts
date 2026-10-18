/** Build an edit payload from changed dirty controls, preserving feature-specific mappings. */
import { AbstractControl } from '@angular/forms';

export interface DirtyLikeContext {
  raw: Record<string, unknown>;
  original: Record<string, unknown>;
  same: (a: unknown, b: unknown) => boolean;
}

export type DirtyLikePostProcess = (
  like: Record<string, unknown>,
  ctx: DirtyLikeContext,
) => void;

export interface BuildDirtyLikeParams<T> {
  form: AbstractControl;
  originalSnapshot: Record<string, unknown> | null;
  isEditing: boolean;
  keys: readonly string[];
  buildCreateLike: () => Partial<T>;
  postProcess?: DirtyLikePostProcess;
}

export function buildDirtyLike<T>(params: BuildDirtyLikeParams<T>): Partial<T> {
  const {
    form,
    originalSnapshot,
    isEditing,
    keys,
    buildCreateLike,
    postProcess,
  } = params;
  const raw = form.getRawValue() as Record<string, unknown>;
  if (!isEditing) {
    return buildCreateLike();
  }
  const original: Record<string, unknown> = originalSnapshot ?? {};
  const same = (a: unknown, b: unknown): boolean =>
    JSON.stringify(a) === JSON.stringify(b);
  const like: Record<string, unknown> = {};
  for (const key of keys) {
    const control = form.get(key);
    if (control?.dirty && !same(raw[key], original[key])) {
      const value = raw[key];
      like[key] = value === '' ? null : value;
    }
  }
  postProcess?.(like, { raw, original, same });
  return like as Partial<T>;
}
