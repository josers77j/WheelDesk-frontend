import type { AuditLogItem } from '../interfaces/audit.interface';

export function auditActorName(log: Pick<AuditLogItem, 'metadata' | 'user'>): string {
  const snapshot = log.metadata?.['actorName'];
  if (typeof snapshot === 'string' && snapshot.trim()) return snapshot;
  return log.user?.name || 'Sin identificar';
}
