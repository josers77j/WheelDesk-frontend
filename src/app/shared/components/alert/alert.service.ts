import { Injectable, signal } from '@angular/core';

export type AlertStateType = 'success' | 'error' | 'warning' | null;

export interface AlertItem {
  id: number;
  type: Exclude<AlertStateType, null>;
  message: string;
  title?: string;
  details?: readonly string[];
}

const MAX_ALERTS = 3;
const AUTO_CLEAR_MS = 6000;
const FADE_OUT_MS = 300;

let nextAlertId = 1;

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  private readonly hosts: symbol[] = [];
  private readonly activeHostValue = signal<symbol | null>(null);
  readonly activeHost = this.activeHostValue.asReadonly();

  alerts = signal<AlertItem[]>([]);
  /** Ids en animación de salida: siguen visibles con fadeOut hasta removerse. */
  leavingIds = signal<ReadonlySet<number>>(new Set());

  registerHost(): symbol {
    const host = Symbol('alert-host');
    this.hosts.push(host);
    if (this.activeHostValue() === null) this.activeHostValue.set(host);
    return host;
  }

  unregisterHost(host: symbol): void {
    const index = this.hosts.indexOf(host);
    if (index === -1) return;
    this.hosts.splice(index, 1);
    if (this.activeHostValue() === host) {
      this.activeHostValue.set(this.hosts[0] ?? null);
    }
  }

  showSuccess(messageAlert: string): void {
    this.push('success', messageAlert);
  }

  showError(messageAlert: string): void {
    this.push('error', messageAlert);
  }

  showWarning(messageAlert: string): void {
    this.push('warning', messageAlert);
  }

  showWarningList(title: string, details: readonly string[]): void {
    this.push('warning', '', title, details);
  }

  dismiss(id: number): void {
    if (!this.alerts().some((alert) => alert.id === id)) return;
    if (this.leavingIds().has(id)) return;
    this.leavingIds.update((ids) => new Set(ids).add(id));
    setTimeout(() => {
      this.alerts.update((alerts) =>
        alerts.filter((alert) => alert.id !== id),
      );
      this.leavingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    }, FADE_OUT_MS);
  }

  clear(): void {
    this.alerts.set([]);
  }

  private push(type: AlertItem['type'], message: string, title?: string, details?: readonly string[]): void {
    const alert: AlertItem = { id: nextAlertId++, type, message, ...(title ? {title, details} : {}) };
    this.alerts.update((alerts) => [...alerts.slice(-(MAX_ALERTS - 1)), alert]);
    setTimeout(() => {
      this.dismiss(alert.id);
    }, AUTO_CLEAR_MS);
  }
}
