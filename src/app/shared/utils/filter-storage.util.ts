export interface SavedFilterValue {
  id: number;
  name: string;
}

/**
 * Nombre del filtro seleccionado (para no pedirlo al backend al restaurar
 * por URL). Solo filtros: los forms resuelven contra su propio dato.
 */
export function saveFilterValue(key: string, value: SavedFilterValue | null): void {
  try {
    if (!value) {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sessionStorage lleno o bloqueado: se sigue sin caché.
  }
}

export function loadFilterValue(key: string): SavedFilterValue | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedFilterValue>;
    if (typeof parsed.id !== 'number' || typeof parsed.name !== 'string') {
      return null;
    }
    return { id: parsed.id, name: parsed.name };
  } catch {
    return null;
  }
}
