import { TRANSFER_STATUS } from "../enums/transfer-status.enum";

export interface TransferResponse {
  data: Transfer[];
  meta: Meta;
}

export interface Transfer {
  id: number;
  fromZoneId: number;
  toZoneId: number;
  status: TRANSFER_STATUS;
  createdById: number | null;
  createdAt: Date;
  updatedAt: Date | null;
  fromZone: TransferZone | null;
  toZone: TransferZone | null;
  createdBy: TransferUser | null;
  details: TransferDetail[];
}

export interface TransferZone {
  id: number;
  name: string;
}

export interface TransferUser {
  id: number;
  name: string;
}

export interface TransferDetail {
  id?: number;
  productId: number;
  product: ProductDetail;
  quantity: number;
}

export interface ProductDetail {
  id: number;
  name: string;
}

export interface CreateTransferPayload {
  fromZoneId: number;
  toZoneId: number;
  details: { productId: number; quantity: number }[];
}

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}