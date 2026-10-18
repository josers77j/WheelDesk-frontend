export enum TRANSFER_STATUS {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const transferStatusList = [
  {
    status: TRANSFER_STATUS.PENDING,
    title: 'Pendiente',
  },
  {
    status: TRANSFER_STATUS.COMPLETED,
    title: 'Completada',
  },
  {
    status: TRANSFER_STATUS.CANCELLED,
    title: 'Cancelada',
  },
];