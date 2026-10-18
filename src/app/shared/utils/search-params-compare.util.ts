/**
 * Compara dos objetos de search params por las claves indicadas.
 * Normaliza null/undefined/'' para no disparar búsquedas redundantes.
 */
export function sameSearchParams<T extends object>(
  form: T,
  applied: T,
  keys: (keyof T)[],
): boolean {
  return keys.every(
    (key) =>
      ((form[key] as unknown) ?? '') === ((applied[key] as unknown) ?? ''),
  );
}
