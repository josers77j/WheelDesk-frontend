import {
  ProductTirePayload,
  Product,
} from '../../products/interfaces/product.interface';

export interface PurchaseProviderDraft {
  name: string;
  nrc: string;
  nit: string;
  phone?: string;
  email?: string;
}
export interface PurchaseSourceLine {
  number: number;
  description: string;
  quantity: number;
  unitPrice: string;
  code: string | null;
}
export interface PurchaseSourcePreview {
  identity: string;
  provider: Required<PurchaseProviderDraft>;
  lines: PurchaseSourceLine[];
  providerMatch: ({ id: number } & PurchaseProviderDraft) | null;
  brands: { id: number; name: string }[];
}
export interface PurchaseNewProduct {
  type: 'TIRE' | 'SUPPLY';
  brandId?: number;
  brand?: { name: string };
  tire?: Partial<ProductTirePayload>;
  supply?: Partial<
    Pick<
      Product,
      | 'name'
      | 'notes'
      | 'purchasePrice'
      | 'salePrice'
      | 'itemTypeCatalogId'
      | 'unitOfMeasureCatalogId'
      | 'taxType'
    >
  >;
}
export interface AssistedPurchaseLine {
  key: string;
  description: string;
  sourceLine?: number;
  productId?: number;
  product?: PurchaseNewProduct;
  quantity: number;
  unitPrice: string;
  suggestedZoneId?: number;
}
export interface AssistedPurchasePayload {
  requestId: string;
  warehouseId?: number;
  pdfConfirmed?: boolean;
  mode: 'MANUAL' | 'DOCUMENT';
  source?: 'JSON';
  providerId?: number;
  provider?: PurchaseProviderDraft;
  details: AssistedPurchaseLine[];
}
export interface PurchaseRowDraft extends AssistedPurchaseLine {
  sourceLines?: number[];
  draftVehicleTypes?: Product['productVehicleType'];
  draftCatalog?: { unit?: { id: number; name: string }; item?: { id: number; name: string } };
  warehouse?: { id: number; name: string } | null;
  zone?: { id: number; name: string } | null;
  zoneOptions?: { id: number; name: string }[];
  zoneLoading?: boolean;
  zoneVersion?: number;
  productOptions?: { id: number; name: string }[];
  productLoading?: boolean;
  productVersion?: number;
  prepared?: boolean;
  searchText?: string;
  validationAttempted?: boolean;
  brandMode?: 'existing' | 'new';
  brandSelected?: { id: number; name: string } | null;
  brandOptions?: { id: number; name: string }[];
  brandLoading?: boolean;
  choice: 'existing' | 'new' | '';
  type: 'TIRE' | 'SUPPLY' | '';
  brandName: string;
  selected: { id: number; name: string } | null;
  ready: boolean;
}
