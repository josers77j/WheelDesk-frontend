import { Injectable } from '@angular/core';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';

@Injectable({ providedIn: 'root' })
export class PdfEngineService {
  async load(source: Blob | string): Promise<PDFDocumentLoadingTask> {
    const pdf = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const assets = new URL('assets/pdfjs-6.4.299-legacy/', document.baseURI).href;
    pdf.GlobalWorkerOptions.workerSrc = `${assets}pdf.worker.min.mjs`;
    const input = typeof source === 'string'
      ? { url: source, withCredentials: false }
      : { data: new Uint8Array(await source.arrayBuffer()) };
    return pdf.getDocument({
      ...input,
      standardFontDataUrl: `${assets}standard_fonts/`,
      cMapUrl: `${assets}cmaps/`, cMapPacked: true,
      wasmUrl: `${assets}wasm/`, iccUrl: `${assets}iccs/`,
    });
  }
}
