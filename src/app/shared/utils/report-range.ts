export function currentSvDay(): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (name: string): string =>
    parts.find((value) => value.type === name)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Mirrors the backend report boundary, using its El Salvador defaults. */
export function reportRangeError(
  from?: string | null,
  to?: string | null,
  maxDays = 366,
): string | null {
  const today = currentSvDay();
  const start = from || `${today.slice(0, 7)}-01`;
  const end = to || today;
  for (const key of [start, end]) {
    const date = new Date(`${key}T12:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(key) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== key
    ) {
      return 'Selecciona fechas válidas.';
    }
  }
  if (start > end) return 'La fecha inicial no puede ser posterior a la final.';
  if (
    (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) /
      86400000 +
      1 >
    maxDays
  )
    return `Selecciona un período de hasta ${maxDays} días.`;
  return null;
}
