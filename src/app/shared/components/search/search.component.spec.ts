import { fakeAsync, tick, TestBed } from '@angular/core/testing';
import { SearchComponent } from './search.component';

describe('Search pending requests', (): void => {
  it('does not emit a second search or reset while busy', (): void => {
    const fixture = TestBed.createComponent(SearchComponent);
    const emit = spyOn(fixture.componentInstance.outputParam, 'emit');
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    fixture.componentInstance.emitNow();
    fixture.componentInstance.clear();
    expect(emit).not.toHaveBeenCalled();
    fixture.componentRef.setInput('busy', false);
    fixture.componentInstance.emitNow();
    expect(emit).toHaveBeenCalledTimes(1);
  });
  it('separates the search action from the field without losing entered text', (): void => {
    const fixture = TestBed.createComponent(SearchComponent);
    fixture.componentRef.setInput('showButton', false);
    fixture.detectChanges();
    const emit = spyOn(fixture.componentInstance.outputParam, 'emit');
    fixture.componentInstance.onType('AUSTONE');
    fixture.componentInstance.emitNow();
    expect(emit).toHaveBeenCalledOnceWith('AUSTONE');
    const host: unknown = fixture.nativeElement;
    if (!(host instanceof HTMLElement)) throw new Error('Expected search host');
    expect(host.textContent).not.toContain('Buscar');
    fixture.destroy();
  });
  it('clears an unsubmitted draft without scheduling a delayed extra search', fakeAsync((): void => {
    const fixture = TestBed.createComponent(SearchComponent);
    fixture.detectChanges();
    const emit = spyOn(fixture.componentInstance.outputParam, 'emit');
    fixture.componentInstance.onType('draft');
    fixture.detectChanges();
    fixture.componentInstance.resetInput();
    fixture.detectChanges();
    tick(1100);
    expect(fixture.componentInstance.inputValue()).toBe('');
    expect(emit).not.toHaveBeenCalled();
    fixture.destroy();
  }));

});
