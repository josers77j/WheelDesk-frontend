export interface WarehouseResponse {
  data: Warehouse[];
  meta: Meta;
}

export interface Warehouse {
  id: number;
  name: string;
  address: string | null;
  zones: Zone[];
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

export interface Zone {
  id: number;
  name: string;
  warehouseId: number;
  createdAt: Date;
  updatedAt: Date | null;
  deletedAt: Date | null;
}

export interface CreateWarehousePayload {
  name: string;
  address?: string | null;
  zones?: { name: string }[];
}

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}