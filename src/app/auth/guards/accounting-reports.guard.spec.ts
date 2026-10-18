import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { accountingReportsGuard, accountantWorkspaceGuard } from './accounting-reports.guard';

describe('Accounting route boundaries', () => {
  function setup(role: string) {
    TestBed.configureTestingModule({ providers: [provideRouter([]), {provide:AuthService,useValue:{user:()=>({role})}}] });
  }
  it('redirects accountants away from every other workspace route', () => {
    setup('ACCOUNTANT');
    const result=TestBed.runInInjectionContext(()=>accountantWorkspaceGuard(new ActivatedRouteSnapshot(), {url:'/products/list'} as RouterStateSnapshot));
    expect(result).toEqual(TestBed.inject(Router).createUrlTree(['/accounting-reports']));
  });
  for (const role of ['ADMIN','ACCOUNTANT']) {
    it(`allows reports for ${role}`,()=>{setup(role);expect(TestBed.runInInjectionContext(()=>accountingReportsGuard({},[]))).toBeTrue();});
  }
  it('allows the dashboard home for accountants', (): void => {
    setup('ACCOUNTANT');
    const router = TestBed.inject(Router);
    router.routerState.snapshot.url = '/';
    expect(TestBed.runInInjectionContext(() => accountantWorkspaceGuard(new ActivatedRouteSnapshot(), router.routerState.snapshot))).toBeTrue();
  });
  it('rejects reports for sellers', (): void => { setup('SELLER'); expect(TestBed.runInInjectionContext(()=>accountingReportsGuard({},[]))).toEqual(TestBed.inject(Router).createUrlTree(['/'])); });
  it('rejects reports for viewers',()=>{setup('VIEWER');expect(TestBed.runInInjectionContext(()=>accountingReportsGuard({},[]))).toEqual(TestBed.inject(Router).createUrlTree(['/']));});
});
