import { Component, ElementRef, DestroyRef, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SaleOrderService } from '../../services/sale-order.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import type { SaleOrder } from '../../interfaces/sale-order.interface';

@Component({
  selector: 'app-sale-email-actions',
  imports: [FormsModule],
  host: { class: 'contents' },
  templateUrl: './sale-email-actions.component.html',
})
export class SaleEmailActionsComponent {
  readonly order = input.required<SaleOrder>();
  private readonly service = inject(SaleOrderService);
  private readonly customers = inject(CustomerService);
  private readonly alerts = inject(AlertService);
  private destroyed = false;
  private requestVersion = 0;
  private targetId = 0;
  readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('emailDialog');
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly recipient = signal<'client' | 'manual'>('client');
  readonly email = signal('');
  readonly clientEmail = signal('');
  readonly pdf = signal(false);
  readonly json = signal(false);
  readonly availablePdf = signal(false);
  readonly availableJson = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => { this.destroyed = true; this.requestVersion += 1; });
  }

  async open(): Promise<void> {
    if (this.busy()) return;
    const order = this.order();
    const version = ++this.requestVersion;
    this.targetId = order.id;
    this.email.set(''); this.clientEmail.set('');
    this.availablePdf.set(!!order.document?.pdfKey); this.pdf.set(this.availablePdf());
    this.availableJson.set(!!order.document?.jsonKey); this.json.set(this.availableJson());
    this.recipient.set('manual'); this.loading.set(!!order.customerId);
    this.dialog()?.nativeElement.showModal();
    if (!order.customerId) return;
    try {
      const customer = await firstValueFrom(this.customers.getCustomerById(order.customerId));
      if (this.destroyed || version !== this.requestVersion) return;
      this.clientEmail.set(customer.email ?? '');
      this.recipient.set(this.clientEmail() ? 'client' : 'manual');
    } catch {
      if (!this.destroyed && version === this.requestVersion) this.alerts.showWarning('No se pudo consultar el correo del cliente. Puedes escribir otro correo.');
    } finally {
      if (!this.destroyed && version === this.requestVersion) this.loading.set(false);
    }
  }

  close(): void {
    if (this.busy()) return;
    this.requestVersion += 1; this.loading.set(false);
    this.dialog()?.nativeElement.close();
  }

  async send(): Promise<void> {
    if (this.busy() || this.loading() || (!this.pdf() && !this.json())) return;
    const attachments: ('pdf' | 'json')[] = [];
    if (this.pdf()) attachments.push('pdf');
    if (this.json()) attachments.push('json');
    this.busy.set(true);
    try {
      const result = await firstValueFrom(this.service.sendEmail(this.targetId, {
        recipient: this.recipient(), attachments,
        ...(this.recipient() === 'manual' ? { email: this.email().trim() } : {}),
      }));
      if (this.destroyed) return;
      if (result.emailStatus === 'sent') { this.dialog()?.nativeElement.close(); this.alerts.showSuccess('Documentos enviados por correo.'); }
      else this.alerts.showWarning(result.message);
    } catch {
      if (!this.destroyed) this.alerts.showError('No se pudieron enviar los documentos. Verifica el correo y los archivos o intenta nuevamente.');
    } finally { if (!this.destroyed) this.busy.set(false); }
  }
}
