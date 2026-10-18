export interface ProductResponse {
  data: Product[];
  meta: Meta;
}

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  type: string;
  purchasePrice: string;
  salePrice: string;
  stock: number;
  notes: null | string;
  brandId: number | null;
  providerId: number | null;
  createdById: number | null;
  updatedById: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  brand: Brand | null;
  tire: Tire | null;
  provider?: Provider | null;
  taxType?: string | null;
  itemTypeCatalogId?: number | null;
  unitOfMeasureCatalogId?: number | null;
  itemTypeCatalog?: CatalogItem | null;
  unitOfMeasureCatalog?: CatalogItem | null;
  productVehicleType?: ProductVehicleType[];
  ProductZoneStock?: ProductZoneStockItem[];
  images?: ProductImage[];
}

export interface ProductImage {
  id: number;
  url: string;
  key: string;
  order: number | null;
}

export interface ProductVehicleType {
  vehicleTypeId: number;
  vehicleType: {
    id: number;
    name: string;
  };
}

export interface ProductZoneStockItem {
  quantity: number;
  zone: {
    name: string;
    warehouse: {
      name: string;
    };
  };
}

export interface Tire {
  prefix: PREFIX | null | '';
  width: number;
  aspectRatio: number | null;
  construction: CONSTRUCTION;
  rimDiameter: string;
  loadIndexFront: number | null;
  loadIndexRear: number | null;
  speedRating: string | null;
  loadRange: LOAD_RANGE | null | '';
  plies: number | null;
  vehicleTypeId: number[];
  condition: TIRE_CONDITION | null;
  quality: TIRE_QUALITY | null;
}

/** Payload enviado al backend al crear/actualizar una llanta. */
export interface TireRequest {
  prefix?: PREFIX | '' | null | undefined;
  width: number;
  aspectRatio?: number | null | undefined;
  construction?: CONSTRUCTION;
  rimDiameter: number;
  loadIndexFront?: number | null | undefined;
  loadIndexRear?: number | null | undefined;
  speedRating?: string | null | undefined;
  loadRange?: LOAD_RANGE | '' | null | undefined;
  plies?: number | null | undefined;
  condition?: TIRE_CONDITION | null;
  quality?: TIRE_QUALITY | null;
  vehicleTypeId?: number[];
}

/** Payload de un producto (solo los campos usados por las llantas). */
export interface ProductTirePayload {
  notes?: string | null;
  salePrice?: string | null;
  purchasePrice?: string | null;
  brandId?: number | null;
  providerId?: number | null;
  itemTypeCatalogId?: number | null;
  unitOfMeasureCatalogId?: number | null;
  tire?: Partial<TireRequest>;
}

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiResponse {
  data: Product[];
  meta: Meta;
}

export interface Provider {
  id: number;
  name: string;
}

export interface Brand {
  id: number;
  name: string;
}

export interface User {
  name: string;
}

export enum TIRE_CONDITION {
  NEW = 'NEW',
  USED = 'USED',
  EMERGENCY = 'EMERGENCY',
}

export enum TIRE_QUALITY {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
}

export enum VEHICLE_TYPE {
  SEDAN = 'SEDAN',
  PICKUP = 'PICKUP',
  TRUCK = 'TRUCK',
  MOTORCYCLE = 'MOTORCYCLE',
}

export enum PREFIX {
  P = 'P',
  LT = 'LT',
  ST = 'ST',
  T = 'T',
}

export enum CONSTRUCTION {
  RADIAL = 'RADIAL',
  BIAS = 'BIAS',
  BELTED = 'BELTED',
}

export enum LOAD_RANGE {
  REINFORCED = 'REINFORCED',
  EXTRA_LOAD = 'EXTRA_LOAD',
}

/** Speed rating codes (single letter, no I/O/Q per industry convention). */
export enum SPEED_RATING {
  J = 'J',
  K = 'K',
  L = 'L',
  M = 'M',
  N = 'N',
  P = 'P',
  Q = 'Q',
  R = 'R',
  S = 'S',
  T = 'T',
  U = 'U',
  H = 'H',
  V = 'V',
  W = 'W',
  Y = 'Y',
  Z = 'Z',
}

export interface VehicleType {
  id: number;
  name: string;
}

export interface CatalogItem {
  id: number;
  name: string;
  code?: string;
}
