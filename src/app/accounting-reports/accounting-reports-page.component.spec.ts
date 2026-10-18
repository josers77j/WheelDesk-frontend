import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { AccountingReportsPageComponent } from './accounting-reports-page.component';
import { AccountingReportsService, ReportDownload } from './accounting-reports.service';
import { AlertService } from '../shared/components/alert/alert.service';

describe('AccountingReportsPageComponent', () => {
  function setup() {
    const pending = new Subject<ReportDownload>();
    const service = jasmine.createSpyObj<AccountingReportsService>('reports', ['period', 'export']);
    service.period.and.returnValue(of({ firstDate: '2026-02-12', today: '2027-10-10', periods:['2026-02','2026-04','2027-01','2027-10'] }));
    service.export.and.returnValue(pending);
    TestBed.configureTestingModule({providers:[{provide:AccountingReportsService,useValue:service},AlertService]});
    const page = TestBed.runInInjectionContext(() => new AccountingReportsPageComponent());
    return { page, service, pending };
  }
  it('limits year and month choices using the first invoice and today', () => {
    const {page,service}=setup(); expect(page.years).toEqual([2026,2027]);
    page.year=2026; expect(page.months).toEqual([2,4]);
    page.year=2027; expect(page.months.at(-1)).toBe(10);
    page.selectMonth(); expect(service.export).not.toHaveBeenCalled(); expect(service.period).toHaveBeenCalledTimes(1);
  });
  it('requires format and rejects 32 days without making a request', () => {
    const {page,service}=setup(); page.from='2026-02-01';page.to='2026-03-03';page.download();
    expect(service.export).not.toHaveBeenCalled();page.formats=['pdf','json'];page.to='2026-03-04';page.download();
    expect(service.export).not.toHaveBeenCalled();
  });
  it('accepts 31 days across months and blocks duplicate export until completion', () => {
    const {page,service,pending}=setup(); page.from='2026-02-01';page.to='2026-03-03';page.formats=['pdf','json'];
    page.download();page.download();expect(service.export).toHaveBeenCalledOnceWith('2026-02-01','2026-03-03',['pdf','json']);
    expect(page.busy()).toBeTrue();pending.error(new Error('failed'));expect(page.busy()).toBeFalse();
  });
  it('rejects future dates before export', () => {
    const {page,service}=setup();page.from='2027-10-01';page.to='2027-10-11';page.formats=['excel'];page.download();expect(service.export).not.toHaveBeenCalled();
  });
  it('shows one Excel at the root and documents in the folder for combined formats', () => {
    const {page,service}=setup();page.toggleFormat('pdf');page.toggleFormat('json');page.toggleFormat('excel');
    expect(page.packageEntries).toEqual(['resumen.xlsx','facturas/Facturas PDF del período','facturas/Archivos JSON del período']);
    page.toggleFormat('json');page.toggleFormat('excel');expect(page.packageEntries).toEqual(['Facturas PDF del período']);
    expect(service.export).not.toHaveBeenCalled();
  });

});
