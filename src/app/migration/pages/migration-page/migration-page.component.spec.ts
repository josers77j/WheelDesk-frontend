import { TestBed} from '@angular/core/testing';
import { MigrationPageComponent } from './migration-page.component';
import { MigrationService } from '../../services/migration.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import type { MigrationImportResult } from '../../interfaces/migration.interface';

describe('Synchronous migration import', (): void => {
  let service: jasmine.SpyObj<MigrationService>;
  let alerts: jasmine.SpyObj<AlertService>;
  const result: MigrationImportResult = {
    total: 2,
    summary: { migrated: 1, skipped: 0, failed: 1 },
    errors: [{ filename: 'invalid.json', detail: 'Invalid JSON' }],
    orphans: ['orphan.pdf'],
    attached: [],
  };
  beforeEach((): void => {
    service = jasmine.createSpyObj('MigrationService', ['preview', 'import']);
    service.preview.and.returnValue(Promise.resolve({ files: [] }));
    service.import.and.returnValue(Promise.resolve(result));
    alerts = jasmine.createSpyObj('AlertService', ['showSuccess', 'showError']);
    TestBed.configureTestingModule({ imports: [MigrationPageComponent], providers: [
      { provide: MigrationService, useValue: service },
      { provide: AlertService, useValue: alerts },
    ] });
    TestBed.overrideComponent(MigrationPageComponent, { set: { template: '', imports: [] } });
  });
  async function settle(): Promise<void> { for (let index = 0; index < 12; index++) await new Promise<void>(resolve => setTimeout(resolve, 0)); }
  function selectFile(component: MigrationPageComponent): void {
    const input = document.createElement('input');
    const transfer = new DataTransfer();
    transfer.items.add(new File(['{}'], 'invoice.json', { type: 'application/json' }));
    input.type = 'file'; input.files = transfer.files;
    input.addEventListener('change', (event: Event): void => component.onFilesSelected(event));
    input.dispatchEvent(new Event('change'));

  }
  it('uses the final response and preserves per-file errors and orphan PDFs', async (): Promise<void> => {
    const fixture = TestBed.createComponent(MigrationPageComponent);
    const component = fixture.componentInstance;
    selectFile(component); await settle(); await component.startImport();
    expect(component.importing()).toBeFalse();
    expect(component.importSummary()).toEqual(result.summary);
    expect(component.importErrors().map(error => error.filename)).toEqual(['invalid.json', 'orphan.pdf']);
    expect(alerts.showSuccess).toHaveBeenCalledWith('Importación finalizada: 1 importadas, 0 omitidas, 1 fallidas');
    fixture.destroy();
  });
  it('does not submit a second batch while the request is pending', async (): Promise<void> => {
    service.import.and.returnValue(new Promise<MigrationImportResult>(() => undefined));
    const fixture = TestBed.createComponent(MigrationPageComponent);
    selectFile(fixture.componentInstance); await settle();
    fixture.componentInstance.startImport(); fixture.componentInstance.startImport();
    expect(service.import).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.importing()).toBeTrue(); fixture.destroy();
  });
  it('ignores the final notification after leaving the page', async (): Promise<void> => {
    let complete: ((value: MigrationImportResult) => void) | undefined;
    service.import.and.returnValue(new Promise<MigrationImportResult>(resolve => { complete = resolve; }));
    const fixture = TestBed.createComponent(MigrationPageComponent);
    selectFile(fixture.componentInstance); await settle(); fixture.componentInstance.startImport(); fixture.destroy();
    complete?.(result); await settle();
    expect(alerts.showSuccess).not.toHaveBeenCalled();
  });
  function selectMany(component: MigrationPageComponent, count: number): void {
    const transfer = new DataTransfer();
    for (let index = 0; index < count; index++) transfer.items.add(new File(['{}'], `invoice-${index}.json`));
    component.onDrop(new DragEvent('drop', { dataTransfer: transfer }));
  }
  it('continues later batches when a document fails and accumulates compact counters', async (): Promise<void> => {
    const fixture = TestBed.createComponent(MigrationPageComponent);
    selectMany(fixture.componentInstance, 11); await settle();
    expect(service.preview).toHaveBeenCalledTimes(2);
    await fixture.componentInstance.startImport();
    expect(service.import).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.importSummary()).toEqual({ migrated: 2, skipped: 0, failed: 2 });
    expect(fixture.componentInstance.completedBatches()).toBe(2);
    fixture.destroy();
  });
  it('stops on an unknown transport outcome and retries only pending batches', async (): Promise<void> => {
    const fixture = TestBed.createComponent(MigrationPageComponent);
    selectMany(fixture.componentInstance, 21); await settle();
    service.import.and.returnValues(Promise.resolve(result), Promise.reject(new Error('network')));
    await fixture.componentInstance.startImport();
    expect(service.import).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.completedBatches()).toBe(1);
    expect(fixture.componentInstance.importInterrupted()).toBeTrue();
    service.import.and.returnValue(Promise.resolve(result));
    await fixture.componentInstance.startImport();
    expect(service.import).toHaveBeenCalledTimes(4);
    expect(fixture.componentInstance.completedBatches()).toBe(3);
    expect(fixture.componentInstance.importSummary()).toEqual({ migrated: 3, skipped: 0, failed: 3 });
    fixture.destroy();
  });
  it('does not submit documents after removing the entire selection', async (): Promise<void> => {
    const fixture = TestBed.createComponent(MigrationPageComponent);
    const component = fixture.componentInstance;
    selectFile(component); await settle();
    component.toggleSelect('invoice.json');
    component.removeSelected();
    await component.startImport();
    expect(service.import).not.toHaveBeenCalled();
    expect(component.totalBatches()).toBe(0);
    expect(component.files()).toEqual([]);
    fixture.destroy();
  });

});
