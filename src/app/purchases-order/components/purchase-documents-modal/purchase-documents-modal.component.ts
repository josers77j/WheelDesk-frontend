import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { PdfPreviewComponent } from '../../../shared/components/pdf-preview/pdf-preview.component';
import { PurchaseDocumentFormat, PurchaseDocumentsService } from '../../services/purchase-documents.service';

@Component({ selector: 'app-purchase-documents-modal', imports: [ReactiveFormsModule, PdfPreviewComponent], templateUrl: './purchase-documents-modal.component.html' })
export class PurchaseDocumentsModalComponent {
  private readonly api = inject(PurchaseDocumentsService);
  private readonly alerts = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly jsonDialog = viewChild<ElementRef<HTMLDialogElement>>('jsonDialog');
  private readonly pdfViewer = viewChild(PdfPreviewComponent);
  private readonly files = new Map<PurchaseDocumentFormat, { blob: Blob; filename: string }>();
  private revision = 0;
  private destroyed = false;
  readonly ids = signal<number[]>([]);
  readonly bulk = signal(false);
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
  openZip(ids: number[]): void {
    if (this.busy() || !ids.length) return;
    this.reset([...ids], true); this.available.set({ pdf: true, json: true }); this.selected.set({ pdf: true, json: true });
  }
  private reset(ids: number[], bulk: boolean): void {
    this.revision++; this.files.clear(); this.ids.set(ids); this.bulk.set(bulk);
    this.recipient.reset(); this.jsonText.set(''); this.available.set({ pdf: false, json: false }); this.selected.set({ pdf: false, json: false });
    this.dialog()?.nativeElement.showModal();
  }
  close(): void { if (!this.busy()) { this.revision++; this.files.clear(); this.dialog()?.nativeElement.close(); } }
  private async file(format: PurchaseDocumentFormat): Promise<{ blob: Blob; filename: string }> {
    const cached = this.files.get(format);
    if (cached) return cached;
    const response = await firstValueFrom(this.api.file(this.ids()[0], format).pipe(takeUntilDestroyed(this.destroyRef)));
    if (!response.body) throw new Error('El documento original está vacío.');
    let filename = `compra-${this.ids()[0]}.${format}`;
    const disposition = response.headers.get('Content-Disposition') || '';
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
    try { filename = encoded ? decodeURIComponent(encoded) : /filename="([^"]+)"/i.exec(disposition)?.[1] || filename; } catch { /* Keep the safe fallback name. */ }
    const file = { blob: response.body, filename }; this.files.set(format, file); return file;
  }
  async preview(format: PurchaseDocumentFormat): Promise<void> {
    if (this.busy() || !this.available()[format]) return;
    await this.run(`preview-${format}`, async () => {
      const file = await this.file(format);
      if (this.destroyed) return;
      if (format === 'pdf') await this.pdfViewer()?.open(file.blob, file.filename);
      else { const value: unknown = JSON.parse(await file.blob.text()); this.jsonText.set(JSON.stringify(value, null, 2)); this.jsonDialog()?.nativeElement.showModal(); }
    });
  }
  async download(format: PurchaseDocumentFormat): Promise<void> {
    if (this.busy() || !this.available()[format]) return;
    await this.run(`download-${format}`, async () => { const file = await this.file(format); if (!this.destroyed) this.saveBlob(file.blob, file.filename); });
  }
  async downloadZip(): Promise<void> {
    if (this.busy() || !this.formats().length) return;
    await this.run('zip', async () => { const blob = await firstValueFrom(this.api.zip(this.ids(), this.formats()).pipe(takeUntilDestroyed(this.destroyRef))); if (!this.destroyed) this.saveBlob(blob, 'documentos-compras.zip'); });
  }
  async sendEmail(): Promise<void> {
    this.recipient.markAsTouched();
    if (this.busy() || this.bulk() || this.recipient.invalid || !this.formats().length) return;
    await this.run('email', async () => {
      await firstValueFrom(this.api.email(this.ids()[0], this.recipient.value.trim(), this.formats()).pipe(takeUntilDestroyed(this.destroyRef)));
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
