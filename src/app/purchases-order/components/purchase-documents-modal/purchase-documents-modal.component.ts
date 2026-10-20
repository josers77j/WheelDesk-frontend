import { DatePipe } from '@angular/common';
import { purchaseInvoiceIdentity } from '../../utils/purchase-invoice-identity';
import { Component, DestroyRef, ElementRef, computed, inject, output, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { PdfPreviewComponent } from '../../../shared/components/pdf-preview/pdf-preview.component';
import { PurchaseDocumentFormat, PurchaseDocumentSelection, PurchaseDocumentsService } from '../../services/purchase-documents.service';

@Component({ selector: 'app-purchase-documents-modal', imports: [ReactiveFormsModule, PdfPreviewComponent, DatePipe], templateUrl: './purchase-documents-modal.component.html' })
export class PurchaseDocumentsModalComponent {
  private readonly api = inject(PurchaseDocumentsService);
  private readonly alerts = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly reviewList = viewChild<ElementRef<HTMLElement>>('reviewList');
  private readonly jsonDialog = viewChild<ElementRef<HTMLDialogElement>>('jsonDialog');
  private readonly pdfViewer = viewChild(PdfPreviewComponent);
  private readonly files = new Map<string, { blob: Blob; filename: string }>();
  private revision = 0;
  private destroyed = false;
  readonly ids = signal<number[]>([]);
  readonly bulk = signal(false);
  readonly emailMode = signal(false);
  readonly rows = signal<PurchaseDocumentSelection[]>([]);
  readonly exportAttempted = signal(false);
  readonly emptyPurchases = computed(() => this.bulk() ? this.rows().filter(row => !row.pdf && !row.json) : []);
  readonly allPurchasesEmpty = computed(() => this.ids().length > 0 && this.emptyPurchases().length === this.ids().length);
  readonly selectionChange = output<number[]>();
  readonly invoiceIdentity = purchaseInvoiceIdentity;
  readonly busy = signal('');
  readonly available = signal({ pdf: false, json: false });
  readonly selected = signal({ pdf: false, json: false });
  readonly jsonText = signal('');
  readonly recipient = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(254)] });
  constructor() { this.destroyRef.onDestroy(() => { this.destroyed = true; this.revision++; this.files.clear(); }); }
  formats(): PurchaseDocumentFormat[] { return (['pdf', 'json'] satisfies PurchaseDocumentFormat[]).filter(format => this.selected()[format]); }
  selectionChanged(format: PurchaseDocumentFormat, event: Event): void {
    if (event.target instanceof HTMLInputElement) this.select(format, event.target.checked);
  }
  select(format: PurchaseDocumentFormat, value: boolean): void { if (!this.busy() && this.available()[format]) this.selected.update(current => ({ ...current, [format]: value })); }
  async open(id: number): Promise<void> {
    if (this.busy()) return;
    this.reset([id], false); this.busy.set('loading');
    const revision = this.revision;
    try {
      const status = await firstValueFrom(this.api.status(id).pipe(takeUntilDestroyed(this.destroyRef)));
      if (revision !== this.revision) return;
      const values = { pdf: !!status.pdf, json: !!status.json };
      this.available.set(values); this.selected.set(values);
    } catch (error: unknown) { if (!this.destroyed) this.alerts.showError(await this.errorMessage(error)); }
    finally { if (!this.destroyed) this.busy.set(''); }
  }
  openZip(ids: number[]): Promise<void> { return this.openSelection(ids, false); }
  openEmail(ids: number[]): Promise<void> { return this.openSelection(ids, true); }
  private async openSelection(ids: number[], email: boolean): Promise<void> {
    if (this.busy() || !ids.length) return;
    if (ids.length > 20) { this.alerts.showError('Seleccione como máximo 20 compras por operación.'); return; }
    this.reset([...new Set(ids)], true);
    this.emailMode.set(email);
    this.busy.set('loading');
    const revision = this.revision;
    try {
      const result = await firstValueFrom(this.api.selection(this.ids()).pipe(takeUntilDestroyed(this.destroyRef)));
      if (revision !== this.revision || this.destroyed) return;
      const byId = new Map(result.map(row => [row.id, row]));
      this.rows.set(this.ids().map(id => byId.get(id) ?? {
        id, documentNumber: id, sourceIdentity: null, provider: 'Compra no disponible',
        createdAt: null, pdf: false, json: false,
      }));
      this.updateAvailability();
      this.selected.set(this.available());
    } catch (error: unknown) { if (!this.destroyed) this.alerts.showError(await this.errorMessage(error)); }
    finally { if (!this.destroyed) this.busy.set(''); }
  }
  removePurchase(id: number): void {
    if (this.busy()) return;
    this.ids.update(ids => ids.filter(value => value !== id));
    this.rows.update(rows => rows.filter(row => row.id !== id));
    for (const key of this.files.keys()) if (key.startsWith(id + ':')) this.files.delete(key);
    this.updateAvailability();
    this.selected.update(selected => ({ pdf: selected.pdf && this.available().pdf, json: selected.json && this.available().json }));
    this.selectionChange.emit(this.ids());
  }
  private updateAvailability(): void {
    this.available.set({ pdf: this.rows().some(row => row.pdf), json: this.rows().some(row => row.json) });
  }
  hasFile(format: PurchaseDocumentFormat, id: number): boolean {
    return this.bulk() ? !!this.rows().find(row => row.id === id)?.[format] : this.available()[format];
  }
  private reset(ids: number[], bulk: boolean): void {
    this.revision++; this.files.clear(); this.ids.set(ids); this.bulk.set(bulk);
    this.exportAttempted.set(false); this.rows.set([]); this.emailMode.set(false); this.recipient.reset(); this.jsonText.set(''); this.available.set({ pdf: false, json: false }); this.selected.set({ pdf: false, json: false });
    this.dialog()?.nativeElement.showModal();
  }
  close(): void { if (!this.busy()) { this.revision++; this.files.clear(); this.dialog()?.nativeElement.close(); } }
  private async file(format: PurchaseDocumentFormat, id: number): Promise<{ blob: Blob; filename: string }> {
    const key = id + ':' + format;
    const cached = this.files.get(key);
    if (cached) return cached;
    const response = await firstValueFrom(this.api.file(id, format).pipe(takeUntilDestroyed(this.destroyRef)));
    if (!response.body) throw new Error('El documento original está vacío.');
    let filename = `compra-${id}.${format}`;
    const disposition = response.headers.get('Content-Disposition') || '';
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
    try { filename = encoded ? decodeURIComponent(encoded) : /filename="([^"]+)"/i.exec(disposition)?.[1] || filename; } catch { /* Keep the safe fallback name. */ }
    const file = { blob: response.body, filename }; this.files.set(key, file); return file;
  }
  async preview(format: PurchaseDocumentFormat, id: number = this.ids()[0]): Promise<void> {
    if (this.busy() || !this.hasFile(format, id)) return;
    await this.run(`preview-${format}`, async () => {
      const file = await this.file(format, id);
      if (this.destroyed) return;
      if (format === 'pdf') await this.pdfViewer()?.open(file.blob, file.filename);
      else { const value: unknown = JSON.parse(await file.blob.text()); this.jsonText.set(JSON.stringify(value, null, 2)); this.jsonDialog()?.nativeElement.showModal(); }
    });
  }
  async download(format: PurchaseDocumentFormat): Promise<void> {
    if (this.busy() || !this.available()[format]) return;
    await this.run(`download-${format}`, async () => { const file = await this.file(format, this.ids()[0]); if (!this.destroyed) this.saveBlob(file.blob, file.filename); });
  }
  private validateSelection(): boolean {
    if (!this.emptyPurchases().length) return true;
    this.exportAttempted.set(true);
    this.reviewList()?.nativeElement.querySelector<HTMLElement>('[data-missing-documents="true"]')?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
    return false;
  }
  async downloadZip(): Promise<void> {
    if (this.busy() || !this.ids().length || !this.validateSelection() || !this.formats().length) return;
    await this.run('zip', async () => { const blob = await firstValueFrom(this.api.zip(this.ids(), this.formats()).pipe(takeUntilDestroyed(this.destroyRef))); if (!this.destroyed) this.saveBlob(blob, 'documentos-compras.zip'); });
  }
  async sendEmail(): Promise<void> {
    this.recipient.setValue(this.recipient.value.trim());
    this.recipient.markAsTouched();
    if (this.busy() || !this.ids().length || this.recipient.invalid || !this.validateSelection() || !this.formats().length) return;
    await this.run('email', async () => {
      const request = this.bulk()
        ? this.api.emailSelection(this.ids(), this.recipient.value, this.formats())
        : this.api.email(this.ids()[0], this.recipient.value, this.formats());
      await firstValueFrom(request.pipe(takeUntilDestroyed(this.destroyRef)));
      if (!this.destroyed) this.alerts.showSuccess('Los documentos se enviaron al correo indicado.');
    });
  }
  private async run(action: string, work: () => Promise<void>): Promise<void> {
    this.busy.set(action);
    try { await work(); } catch (error: unknown) { if (!this.destroyed) this.alerts.showError(await this.errorMessage(error)); }
    finally { if (!this.destroyed) this.busy.set(''); }
  }
  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  private async errorMessage(error: unknown): Promise<string> {
    if (error instanceof HttpErrorResponse) {
      let body: unknown = error.error;
      if (body instanceof Blob) { try { body = JSON.parse(await body.text()); } catch { return 'No se pudo obtener el documento. Intente nuevamente.'; } }
      if (body && typeof body === 'object' && 'message' in body) {
        const message: unknown = body.message;
        if (typeof message === 'string') return message;
        if (Array.isArray(message)) return message.filter((item): item is string => typeof item === 'string').join('\n');
      }
    }
    return error instanceof Error && !(error instanceof HttpErrorResponse) ? error.message : 'No se pudo completar la operación con los documentos. Intente nuevamente.';
  }
}
