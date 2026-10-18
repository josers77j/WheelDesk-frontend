import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PhoneInputComponent } from './phone-input.component';

describe('PhoneInputComponent control callbacks', (): void => {
  let fixture: ComponentFixture<PhoneInputComponent>;

  beforeEach((): void => {
    TestBed.configureTestingModule({ imports: [PhoneInputComponent] });
    fixture = TestBed.createComponent(PhoneInputComponent);
    fixture.detectChanges();
  });

  function enter(value: string): void {
    const input = fixture.nativeElement.querySelector('input');
    if (!(input instanceof HTMLInputElement)) throw new Error('Expected phone input');
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  it('accepts input before callbacks are registered', (): void => {
    expect(() => enter('71234567')).not.toThrow();
    expect(fixture.componentInstance.digits()).toBe('71234567');
  });

  it('emits a normalized value and null on clearing after registration', (): void => {
    const changed = jasmine.createSpy('changed');
    const touched = jasmine.createSpy('touched');
    fixture.componentInstance.registerOnChange(changed);
    fixture.componentInstance.registerOnTouched(touched);
    enter('71234567');
    expect(changed).toHaveBeenCalledOnceWith('+50371234567');
    expect(touched).toHaveBeenCalledTimes(1);
    enter('');
    expect(changed.calls.mostRecent().args).toEqual([null]);
    expect(touched).toHaveBeenCalledTimes(2);
  });

  it('does not emit user changes when writing a model value', (): void => {
    const changed = jasmine.createSpy('changed');
    fixture.componentInstance.registerOnChange(changed);
    fixture.componentInstance.writeValue('+50371234567');
    expect(changed).not.toHaveBeenCalled();
    expect(fixture.componentInstance.digits()).toBe('71234567');
  });
});
