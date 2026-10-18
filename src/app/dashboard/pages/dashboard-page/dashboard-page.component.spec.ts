import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import type { User } from '../../../auth/interfaces/user.interface';
import { TestBed } from '@angular/core/testing';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { DashboardPageComponent } from './dashboard-page.component';
import { DashboardService } from '../../services/dashboard.service';

describe('Dashboard monthly overview', (): void => {
  const role = signal<User['role']>('ADMIN');
  let client: QueryClient;
  let service: jasmine.SpyObj<DashboardService>;
  beforeEach((): void => {
    role.set('ADMIN');
    client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    service=jasmine.createSpyObj<DashboardService>('dashboard',['getPeriod','getSummary']);
    service.getPeriod.and.returnValue(of({firstDate:'2026-02-01',today:'2026-10-10',periods:['2026-02','2026-10']}));
    service.getSummary.and.returnValue(of({kpis:{salesTotal:100,income:100,profit:20,documents:2,ticketAvg:50,prevIncome:80},salesByDay:[{date:'2026-10-01',total:100}],topProducts:[],bottomProducts:[],lowStock:[]}));
    TestBed.configureTestingModule({imports:[DashboardPageComponent],providers:[provideRouter([]), {provide:AuthService,useValue:{user:()=>({role:role()}),isAdmin:()=>role()==='ADMIN'}},provideTanStackQuery(client),{provide:DashboardService,useValue:service}]});
  });
  afterEach((): void => client.clear());
  it('offers only months with documents and shows interactive daily amounts',async():Promise<void>=>{
    const fixture=TestBed.createComponent(DashboardPageComponent);fixture.detectChanges();
    await new Promise<void>(resolve=>setTimeout(resolve,50));fixture.detectChanges();
    await new Promise<void>(resolve=>setTimeout(resolve,50));fixture.detectChanges();
    expect(fixture.componentInstance.months()).toEqual([2,10]);
    expect(service.getSummary).toHaveBeenCalledWith('2026-10-01','2026-10-10');
    const bar: HTMLButtonElement=fixture.nativeElement.querySelector('[aria-label="2026-10-01: 100 dólares"]');
    expect(bar).not.toBeNull();bar.click();fixture.detectChanges();
    expect(fixture.componentInstance.selectedDay()).toEqual({date:'2026-10-01',total:100});
    expect(fixture.nativeElement.textContent).toContain('Ingresos:');
    const calls=service.getSummary.calls.count();fixture.componentInstance.setMonth(3);fixture.detectChanges();
    expect(service.getSummary.calls.count()).toBe(calls);
    expect(fixture.nativeElement.textContent).not.toContain('Mínimo');
    const host: unknown = fixture.nativeElement;
    if (!(host instanceof HTMLElement)) throw new Error('Expected dashboard host');
    expect(host.querySelector('a[href="/accounting-reports"]')).not.toBeNull();
    role.set('VIEWER');
    fixture.detectChanges();
    expect(host.querySelector('select')).toBeNull();
    expect(host.textContent).not.toContain('Ingresos');
    expect(host.querySelector('a[href="/accounting-reports"]')).toBeNull();
  });
  for (const restricted of ['SELLER', 'VIEWER', 'ACCOUNTANT'] as const) {
    it(`shows only allowed content without financial requests for ${restricted}, even with admin cache`, async (): Promise<void> => {
      role.set(restricted);
      client.setQueryData(['dashboard','period'], { firstDate:'2026-02-01',today:'2026-10-10',periods:['2026-10'] });
      client.setQueryData(['dashboard','summary','2026-10'], { kpis:{income:999999,profit:888888},salesByDay:[],topProducts:[],lowStock:[] });
      const fixture = TestBed.createComponent(DashboardPageComponent);
      fixture.detectChanges();
      await new Promise<void>(resolve => setTimeout(resolve, 50));
      fixture.detectChanges();
      const host: unknown = fixture.nativeElement;
      if (!(host instanceof HTMLElement)) throw new Error('Expected dashboard host');
      expect(host.querySelector('h1')?.textContent).toContain('Tu operación de un vistazo');
      expect(host.querySelector('select')).toBeNull();
      expect(host.textContent).not.toContain('Ingresos');
      expect(host.textContent).not.toContain('Ganancias');
      expect(host.textContent).not.toContain('999999');
      expect(host.querySelector('a[href="/accounting-reports"]') !== null).toBe(restricted === 'ACCOUNTANT');
      if (restricted !== 'ACCOUNTANT') expect(host.textContent?.replace(/\s+/g, ' ').trim()).toBe('Tu operación de un vistazo');
      expect(service.getPeriod).not.toHaveBeenCalled();
      expect(service.getSummary).not.toHaveBeenCalled();
      fixture.destroy();
    });
  }

});
