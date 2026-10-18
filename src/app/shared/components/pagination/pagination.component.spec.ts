import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PaginationComponent } from './pagination.component';
import { LimitComponent } from '../limit/limit.component';

@Component({
  imports: [PaginationComponent, LimitComponent],
  template: `<app-pagination [currentPage]="1" [totalPages]="3" [totalItems]="30" [pageSize]="limit()">
    <app-limit paginationLimit [limitInput]="limit()" (outputLimit)="limit.set($event)" />
  </app-pagination>`,
})
class HostComponent { readonly limit = signal(10); }

describe('Pagination with projected limit', (): void => {
  it('shows the range and retains the limit control change event', (): void => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host: unknown = fixture.nativeElement;
    if (!(host instanceof HTMLElement)) throw new Error('Expected host');
    expect(host.textContent).toContain('Mostrando 1–10 de 30');
    const select = host.querySelector('select');
    if (!(select instanceof HTMLSelectElement)) throw new Error('Expected limit select');
    select.value = '20';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.limit()).toBe(20);
    expect(host.textContent).toContain('Mostrando 1–20 de 30');
    fixture.destroy();
  });
});
