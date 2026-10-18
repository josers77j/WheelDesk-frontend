import { TestBed } from '@angular/core/testing';
import { PdfPreviewComponent } from './pdf-preview.component';
import { PdfEngineService } from './pdf-engine.service';

function samplePdf(): Blob {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 5 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> /Contents 5 0 R >>',
  ];
  const stream = '0 0 1 rg 10 10 80 80 re f\n';
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  let pdf = '%PDF-1.7\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

describe('Shared PDF.js preview', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [PdfPreviewComponent] }));

  it('renders a real PDF using its worker, changes pages and zoom, then releases it', async () => {
    const fixture = TestBed.createComponent(PdfPreviewComponent);
    fixture.detectChanges();
    const viewer = fixture.componentInstance;
    await viewer.open(samplePdf(), 'Factura');
    fixture.detectChanges();
    expect(viewer.error()).toBe('');
    expect(viewer.pages()).toBe(2);
    const canvas: HTMLCanvasElement = fixture.nativeElement.querySelector('canvas');
    expect(canvas.width).toBeGreaterThan(0);
    const context = canvas.getContext('2d');
    expect(context?.getImageData(0, 0, 1, 1).data[3]).toBe(255);
    await viewer.changePage(1);
    expect(viewer.page()).toBe(2);
    await viewer.changeZoom(0.25);
    expect(viewer.zoom()).toBe(1.25);
    viewer.close();
    expect(canvas.width).toBe(0);
    fixture.destroy();
  });

  it('shows an error instead of downloading an invalid PDF', async () => {
    const fixture = TestBed.createComponent(PdfPreviewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.open(new Blob(['invalid']));
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toContain('no es un PDF válido');
    expect(fixture.componentInstance.loading()).toBeFalse();
    fixture.destroy();
  });

  it('identifies a missing worker without blaming the PDF or logging its URL', async () => {
    const fixture = TestBed.createComponent(PdfPreviewComponent);
    fixture.detectChanges();
    const log = spyOn(console, 'error');
    spyOn(TestBed.inject(PdfEngineService), 'load').and.rejectWith(new Error('Setting up fake worker failed: Failed to fetch dynamically imported module: https://example.test/private?signature=secret'));
    await fixture.componentInstance.open(samplePdf());
    expect(fixture.componentInstance.error()).toContain('No se pudo cargar el visor PDF');
    expect(log).toHaveBeenCalledOnceWith('No se pudo previsualizar el PDF.', { reason: 'resources' });
    fixture.destroy();
  });

  it('disposes a load that completes after closing the modal', async () => {
    const fixture = TestBed.createComponent(PdfPreviewComponent);
    fixture.detectChanges();
    const engine = TestBed.inject(PdfEngineService);
    const task = await engine.load(samplePdf());
    const destroy = spyOn(task, 'destroy').and.callThrough();
    spyOn(engine, 'load').and.resolveTo(task);
    const opened = fixture.componentInstance.open(samplePdf());
    fixture.componentInstance.close();
    await opened;
    expect(destroy).toHaveBeenCalled();
    expect(fixture.componentInstance.pages()).toBe(0);
    fixture.destroy();
  });
});
