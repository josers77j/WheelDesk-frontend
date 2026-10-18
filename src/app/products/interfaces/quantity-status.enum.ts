/**
 * Filtro por existencias (espejo del enum del backend).
 * Ausente (o ALL) = trae todo.
 */
export enum QUANTITY_STATUS {
  ALL = 'ALL',
  IN_STOCK = 'IN_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export interface QuantityStatusOption {
  title: string;
  status: QUANTITY_STATUS | '';
}

export const quantityStatusList: QuantityStatusOption[] = [
  { title: 'Todas', status: '' },
  { title: 'En stock', status: QUANTITY_STATUS.IN_STOCK },
  { title: 'Agotados', status: QUANTITY_STATUS.OUT_OF_STOCK },
];
