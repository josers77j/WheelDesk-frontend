export interface User {
  id: number;
  name: string;
  email: string;
  role?: 'ADMIN' | 'SELLER' | 'VIEWER' | 'ACCOUNTANT';
  sessionId?: string;
}
