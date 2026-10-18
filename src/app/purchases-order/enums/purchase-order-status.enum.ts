export enum PURCHASE_ORDER_STATUS  {
  COMPLETED ='COMPLETED',
  REJECTED = 'REJECTED',
  PENDING= 'PENDING'
}

export interface PurchaseOrderStatus {
  title: string;
  status: PURCHASE_ORDER_STATUS
}

export const purchaseOrderStatusList:PurchaseOrderStatus[] = [
  {
    title: 'Completado',
    status: PURCHASE_ORDER_STATUS.COMPLETED
  },
  {
    title: 'Rechazado',
    status: PURCHASE_ORDER_STATUS.REJECTED
  },
  {
    title: 'Pendiente',
    status: PURCHASE_ORDER_STATUS.PENDING
  }
]
