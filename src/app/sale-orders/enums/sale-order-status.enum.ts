export enum SALE_ORDER_STATUS {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  ANNULLED = 'ANNULLED',
  CONTINGENCY = 'CONTINGENCY',
}

export interface SaleOrderStatusOption {
  title: string;
  status: SALE_ORDER_STATUS | '';
}

export const saleOrderStatusList: SaleOrderStatusOption[] = [
  { title: 'Pendiente', status: SALE_ORDER_STATUS.PENDING },
  { title: 'Completada', status: SALE_ORDER_STATUS.COMPLETED },
  { title: 'Rechazada', status: SALE_ORDER_STATUS.REJECTED },
  { title: 'Anulada', status: SALE_ORDER_STATUS.ANNULLED },
  { title: 'Contingencia', status: SALE_ORDER_STATUS.CONTINGENCY },
];
