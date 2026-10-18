export interface BrandResponse {
  data: Brand[];
  meta: Meta;
}

export interface Brand {
  id:          number;
  name:        string;
  description: string;
  createdAt:   Date;
  updatedAt:   Date | null;
  deletedAt:   Date | null;
}

export interface Meta {
  page:            number;
  limit:           number;
  total:           number;
  totalPages:      number;
  hasNextPage:     boolean;
  hasPreviousPage: boolean;
}
