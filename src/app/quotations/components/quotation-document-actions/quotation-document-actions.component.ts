import { Component, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { QuotationService } from '../../services/quotation.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { ConfirmActionModalComponent } from '../../../shared/components/confirm-action-modal/confirm-action-modal.component';
@Component({ selector: 'app-quotation-document-actions', imports: [FormsModule, ConfirmActionModalComponent], host: { class: 'contents' }, templateUrl: './quotation-document-actions.component.html' })
export class QuotationDocumentActionsComponent {
 readonly id = input.required<number>();
 private readonly service = inject(QuotationService);
 private readonly customers = inject(CustomerService);
 private readonly alerts = inject(AlertService);
 private readonly router = inject(Router);
 readonly emailDialog = viewChild<ElementRef<HTMLDialogElement>>('emailDialog');
 readonly conversionDialog = viewChild(ConfirmActionModalComponent);
 readonly busy = signal(false); readonly loadingEmail = signal(false);
 readonly email = signal(''); readonly clientEmail = signal('');
 readonly recipient = signal<'MANUAL' | 'CLIENT'>('MANUAL'); private targetId = 0;
 async download(): Promise<void> {
  if (this.busy()) return;
  const id = this.id(); this.busy.set(true);
  try { const blob = await firstValueFrom(this.service.downloadPdf(id)); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `cotizacion-${id}.pdf`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  catch { this.alerts.showError('No se pudo descargar la cotización. Intenta nuevamente.'); } finally { this.busy.set(false); }
 }
 async openEmail(): Promise<void> {
  this.targetId = this.id(); this.email.set(''); this.clientEmail.set(''); this.recipient.set('MANUAL'); this.loadingEmail.set(true); this.emailDialog()?.nativeElement.showModal();
  try { const quote = await firstValueFrom(this.service.getQuotation(this.targetId)); if (quote.customerId) { const customer = await firstValueFrom(this.customers.getCustomerById(quote.customerId)); this.clientEmail.set(customer.email ?? ''); } }
  catch { this.alerts.showError('No se pudo consultar el correo del cliente. Puedes escribirlo manualmente.'); } finally { this.loadingEmail.set(false); }
 }
 chooseRecipient(source: 'MANUAL' | 'CLIENT'): void { this.recipient.set(source); this.email.set(source === 'CLIENT' ? this.clientEmail() : ''); }
 async send(): Promise<void> {
  if (this.busy() || this.loadingEmail()) return; this.busy.set(true);
  try { await firstValueFrom(this.service.sendEmail(this.targetId, this.email().trim())); this.emailDialog()?.nativeElement.close(); this.alerts.showSuccess('Cotización enviada por correo'); }
  catch { this.alerts.showError('La cotización está guardada, pero el correo no pudo enviarse. Intenta nuevamente o contacta a soporte.'); } finally { this.busy.set(false); }
 }
 confirmConversion(): void { this.targetId = this.id(); this.conversionDialog()?.open(); }
 convert(): void { void this.router.navigate(['/sale-orders/detail', '0'], { queryParams: { quotationId: this.targetId } }); }
}
