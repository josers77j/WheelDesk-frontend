import { Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { AuditService } from '../../../audit/services/audit.service';

interface TimelineItem {
  at: string;
  kind: 'audit';
  title: string;
  detail: string;
  ok: boolean | null;
  extra: string;
}

const AUDIT_LABELS: Record<string, string> = {
  'sale-order.checkout': 'Venta creada',
  'sale-order.email': 'Correo de venta enviado',
  'sale-order.download': 'Originales descargados',
};

@Component({
  selector: 'app-sale-order-activity',
  imports: [DatePipe],
  templateUrl: './sale-activity-modal.component.html',
})
export class SaleActivityModalComponent {
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('activityDialog');
  readonly isOpen = signal(false);

  open(): void {
    const dialog = this.dialog()?.nativeElement;
    if (!this.authService.isAdmin() || !dialog || dialog.open) return;
    this.isOpen.set(true);
    dialog.showModal();
  }

  orderId = input<number>(0);
  orderNumber = input<string>('');

  readonly authService = inject(AuthService);
  private readonly auditService = inject(AuditService);

  auditQuery = injectQuery(() => ({
    queryKey: ['app-sale-order-activity', this.orderId()],
    queryFn: () =>
      firstValueFrom(
        this.auditService.getLogs({
          page: 1,
          limit: 50,
          entityType: 'sale-order',
          entityId: String(this.orderId()),
        }),
      ),
    enabled:
      this.authService.isAdmin() &&
      this.isOpen() &&
      this.dialog()?.nativeElement.open === true &&
      this.orderId() > 0,
    staleTime: 30_000,
  }));

  timeline = computed<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    for (const log of this.auditQuery.data()?.items ?? []) {
      const meta = log.metadata ?? {};
      const detail = String(
        (meta['resolutionNote'] as string) ??
          (meta['codigoLote'] as string) ??
          (meta['reason'] as string) ??
          '',
      );
      items.push({
        at: log.at,
        kind: 'audit',
        title: `${AUDIT_LABELS[log.action] ?? log.action} · ${log.user?.name ?? 'sistema'}`,
        detail,
        ok: null,
        extra: '',
      });
    }
    return items.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  });
}
