
export interface SearchParams {
  width?: number | null;
  aspectRatio?: number | null;
  rimDiameter?: number | null;
  brandId?: number | null;
  providerId?: number | null;
  filter?: string  | null;
  /** Filtro por existencias: ausente/ALL = todo (no molesta al resto). */
  quantityStatus?: string | null;
}
