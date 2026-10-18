export interface ValueParams {
  id: number,
  name: string,
  /** Algunos endpoints (p. ej. products/summary) adjuntan existencias. */
  stock?: number,
  zoneStock?: number,
}
