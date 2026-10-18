import { TestBed } from '@angular/core/testing';
import { QueryErrorComponent } from './query-error.component';

describe('QueryErrorComponent actions', (): void => {
  it('emits retry and reset independently', (): void => {
    TestBed.configureTestingModule({ imports: [QueryErrorComponent] });
    const fixture = TestBed.createComponent(QueryErrorComponent);
    fixture.detectChanges();
    const retry = spyOn(fixture.componentInstance.retry, 'emit');
    const reset = spyOn(fixture.componentInstance.resetFilters, 'emit');
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
    buttons[1].click();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('omits the reset action when disabled by its parent', (): void => {
    TestBed.configureTestingModule({ imports: [QueryErrorComponent] });
    const fixture = TestBed.createComponent(QueryErrorComponent);
    fixture.componentRef.setInput('showReset', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(1);
  });
});
