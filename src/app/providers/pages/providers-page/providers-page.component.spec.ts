import { Component, NO_ERRORS_SCHEMA, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of } from 'rxjs';
import { ProvidersPageComponent } from './providers-page.component';
import { TitleComponent } from '../../../shared/components/title/title.component';
import { AuthService } from '../../../auth/services/auth.service';
import { ProviderService } from '../../services/provider.service';
import { PaginationService } from '../../../shared/components/pagination/pagination.service';
import { DeleteActionModalService } from '../../../shared/components/delete-action-modal/deleteActionModal.service';
import { AlertService } from '../../../shared/components/alert/alert.service';

@Component({selector:'app-provider-form-modal',template:''})
class ProviderFormStubComponent {
  readonly saved=output<void>();
  readonly openForCreate=jasmine.createSpy('openForCreate');
}

describe('Provider creation entry point',()=>{
  const admin=signal(true);
  beforeEach(()=>{
    admin.set(true);
    TestBed.configureTestingModule({providers:[
      provideTanStackQuery(new QueryClient({defaultOptions:{queries:{retry:false}}})),
      {provide:AuthService,useValue:{isAdmin:admin}},
      {provide:ProviderService,useValue:{providerIdSelected:signal(0),getProviders:()=>of({data:[],meta:{page:1,limit:10,total:0,totalPages:0}})}},
      {provide:PaginationService,useValue:{currentPage:signal(1)}},
      {provide:DeleteActionModalService,useValue:{state:signal('idle')}},
      {provide:AlertService,useValue:{}},
      {provide:Router,useValue:{navigate:()=>Promise.resolve(true)}},
      {provide:ActivatedRoute,useValue:{snapshot:{queryParamMap:convertToParamMap({})}}},
    ]});
    TestBed.overrideComponent(ProvidersPageComponent,{set:{imports:[TitleComponent,ProviderFormStubComponent],schemas:[NO_ERRORS_SCHEMA]}});
  });
  it('displays the create button and opens the existing modal for an administrator',()=>{
    const fixture=TestBed.createComponent(ProvidersPageComponent);fixture.detectChanges();
    const host:unknown=fixture.nativeElement;if(!(host instanceof HTMLElement))throw new Error('Expected a host');
    const button=host.querySelector<HTMLButtonElement>('app-title button');
    expect(button?.textContent).toContain('Crear proveedor');button?.click();
    const modal:unknown=fixture.debugElement.query(By.directive(ProviderFormStubComponent)).componentInstance;
    if(!(modal instanceof ProviderFormStubComponent))throw new Error('Expected the provider modal');
    expect(modal.openForCreate).toHaveBeenCalledTimes(1);
  });
  it('hides and blocks creation for a non-administrator',()=>{
    admin.set(false);const fixture=TestBed.createComponent(ProvidersPageComponent);fixture.detectChanges();
    const host:unknown=fixture.nativeElement;if(!(host instanceof HTMLElement))throw new Error('Expected a host');
    expect(host.querySelector('app-title button')).toBeNull();fixture.componentInstance.openCreateModal();
    const modal:unknown=fixture.debugElement.query(By.directive(ProviderFormStubComponent)).componentInstance;
    if(!(modal instanceof ProviderFormStubComponent))throw new Error('Expected the provider modal');
    expect(modal.openForCreate).not.toHaveBeenCalled();
  });
});
