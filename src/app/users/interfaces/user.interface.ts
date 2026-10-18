export type UserRole = 'ADMIN' | 'SELLER' | 'VIEWER' | 'ACCOUNTANT';

export const USER_ROLES: UserRole[] = ['ADMIN', 'SELLER', 'VIEWER', 'ACCOUNTANT'];

export interface UserResponse {
  data: User[];
  meta: Meta;
}

export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  createdAt: Date;
  refreshToken: RefreshToken[];
}

export interface RefreshToken {
  id: string;
  userId: number;
  tokenHash: string;
  userAgent: string;
  deviceType: string;
  ipAddress: string;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
