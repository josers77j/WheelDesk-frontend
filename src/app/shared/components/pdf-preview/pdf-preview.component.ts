import { pdfPreviewFailure } from './pdf-preview-error.util';
import { Component, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { PdfEngineService } from './pdf-engine.service';

@Component({
  selector: 'app-pdf-preview',
  templateUrl: './pdf-preview.component.html',
})
export class PdfPreviewComponent implements OnDestroy {
  private readonly engine = inject(PdfEngineService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly viewport = viewChild<ElementRef<HTMLDivElement>>('viewport');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly title = signal('Documento PDF');
  readonly page = signal(1);
  readonly pages = signal(0);
  readonly zoom = signal(1);
  private task?: PDFDocumentLoadingTask;
  private document?: PDFDocumentProxy;
  private renderTask?: RenderTask;
  private revision = 0;
  private disposed = false;

  async open(source: Blob | string, title = 'Documento PDF'): Promise<void> {
    this.release();
    const revision = this.revision;
    this.title.set(title);
    this.page.set(1);
    this.pages.set(0);
    this.zoom.set(1);
    this.error.set('');
    this.loading.set(true);
    this.dialog()?.nativeElement.showModal();
    try {
      const task = await this.engine.load(source);
      if (this.disposed || revision !== this.revision) {
        void task.destroy().catch(() => undefined);
        return;
      }
      this.task = task;
      const pdf = await task.promise;
      if (this.disposed || revision !== this.revision) return;
      this.document = pdf;
      this.pages.set(pdf.numPages);
      await this.render(revision);
    } catch (error: unknown) {
      if (!this.disposed && revision === this.revision) {
        const failure = pdfPreviewFailure(error);
        console.error('No se pudo previsualizar el PDF.', { reason: failure.code });
        this.error.set(failure.message);
      }
    } finally {
      if (!this.disposed && revision === this.revision) this.loading.set(false);
    }
  }

  async changePage(offset: number): Promise<void> {
    const next = this.page() + offset;
    if (this.loading() || next < 1 || next > this.pages()) return;
    this.page.set(next);
    await this.redraw();
  }

  async changeZoom(amount: number): Promise<void> {
    if (this.loading() || !this.document) return;
    this.zoom.set(Math.max(0.5, Math.min(2, this.zoom() + amount)));
    await this.redraw();
  }

  private async redraw(): Promise<void> {
    this.loading.set(true);
    const revision = this.revision;
    try {
      await this.render(revision);
    } catch {
      if (revision === this.revision) this.error.set('No se pudo mostrar esta página del PDF.');
    } finally {
      if (revision === this.revision) this.loading.set(false);
    }
  }

  private async render(revision: number): Promise<void> {
    const pdf = this.document;
    const canvas = this.canvas()?.nativeElement;
    if (!pdf || !canvas) return;
    const page = await pdf.getPage(this.page());
    if (revision !== this.revision) return;
    const base = page.getViewport({ scale: 1 });
    const width = Math.max(200, (this.viewport()?.nativeElement.clientWidth || 800) - 24);
    const viewport = page.getViewport({ scale: Math.min(2, width / base.width) * this.zoom() });
    const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(8_000_000 / (viewport.width * viewport.height)));
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    this.renderTask = page.render({ canvas, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
    await this.renderTask.promise;
    page.cleanup();
  }

  close(): void {
    this.dialog()?.nativeElement.close();
    this.release();
  }

  private release(): void {
    this.revision++;
    this.renderTask?.cancel();
    this.renderTask = undefined;
    if (this.task) void this.task.destroy().catch(() => undefined);
    this.task = undefined;
    this.document = undefined;
    const canvas = this.canvas()?.nativeElement;
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    this.loading.set(false);
  }

  ngOnDestroy(): void {
    this.disposed = true;
    this.release();
  }
}
