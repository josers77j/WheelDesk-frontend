export interface AuditLogItem {
  id: number;
  at: string;
  userId: number | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  user: { id: number; name: string; email: string } | null;
}

export interface AuditSearchParams {
  page: number;
  limit: number;
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: number;
  from?: string;
  to?: string;
}

export interface AuditListResponse {
  items: AuditLogItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const AUDIT_ACTIONS = [
  'product.create',
  'product.update',
  'product.delete',
  'customer.create',
  'customer.update',
  'customer.delete',
  'purchase.create',
  'purchase.update',
  'purchase.approve',
  'purchase.reject',
  'transfer.create',
  'transfer.cancel',
  'quotation.create',
  'quotation.update',
  'quotation.email',
  'sale.create',
  'migration.import',
  'invoice.resend',
  'invoice.recover',
  'invoice.download',
  'report.download',
  'report.regenerate',
  'email.send',
  'whatsapp.send',
  'contingency.open',
  'contingency.close',
  'contingency.recover',
  'auth.login',
  'auth.logout',
] as const;
