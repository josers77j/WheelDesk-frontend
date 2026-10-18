export interface ProviderResponse {
  data: Provider[];
  meta: Meta;
}

export interface Provider {
  nrc?: string | null;
  nit?: string | null;
  phone?: string | null;
  email?: string | null;
  id:          number;
  name:        string;
  description: string;
  createdAt:   Date;
  updatedAt:   null;
  deletedAt:   null;
}

export interface Meta {
  page:            number;
  limit:           number;
  total:           number;
  totalPages:      number;
  hasNextPage:     boolean;
  hasPreviousPage: boolean;
}
