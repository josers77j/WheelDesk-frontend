import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerMissingInfoComponent } from './customer-missing-info.component';

describe('Customer missing information tooltip', () => {
  let fixture: ComponentFixture<CustomerMissingInfoComponent>;
  let button: HTMLButtonElement;
  let tooltip: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CustomerMissingInfoComponent] }).compileComponents();
    fixture = TestBed.createComponent(CustomerMissingInfoComponent);
    fixture.componentRef.setInput('fields', ['NIT', 'Dirección']);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const trigger = host.querySelector('button');
    const popup = host.querySelector<HTMLElement>('[role="tooltip"]');
    if (!trigger || !popup) throw new Error('Missing tooltip elements');
    button = trigger;
    tooltip = popup;
  });

  afterEach(() => fixture.destroy());

  it('opens in the top layer even inside an isolated and clipped customer card', () => {
    const host: HTMLElement = fixture.nativeElement;
    host.style.cssText = 'isolation:isolate;overflow:hidden;width:30px;height:30px;position:relative;';
    button.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(tooltip.matches(':popover-open')).toBeTrue();
    expect(tooltip.textContent?.trim()).toBe('Faltan: NIT, Dirección');
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(tooltip.getBoundingClientRect().width).toBeGreaterThan(30);
  });

  it('keeps the warning within the viewport near the right edge and wraps long text', () => {
    fixture.componentRef.setInput('fields', ['Dirección completa '.repeat(25)]);
    fixture.detectChanges();
    const width = document.documentElement.clientWidth;
    spyOn(button, 'getBoundingClientRect').and.returnValue(new DOMRect(width - 20, 0, 20, 20));
    button.dispatchEvent(new FocusEvent('focus'));
    const bounds = tooltip.getBoundingClientRect();
    expect(tooltip.matches(':popover-open')).toBeTrue();
    expect(bounds.left).toBeGreaterThanOrEqual(8);
    expect(bounds.right).toBeLessThanOrEqual(width - 7);
    expect(bounds.top).toBeGreaterThanOrEqual(8);
    expect(tooltip.style.overflowWrap).toBe('anywhere');
  });

  it('supports touch without bubbling the click to the customer row and closes on Escape or outside press', () => {
    const rowClick = jasmine.createSpy('rowClick');
    const host: HTMLElement = fixture.nativeElement;
    host.addEventListener('click', rowClick);
    button.click();
    expect(rowClick).not.toHaveBeenCalled();
    expect(button.type).toBe('button');
    expect(tooltip.matches(':popover-open')).toBeTrue();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(tooltip.matches(':popover-open')).toBeFalse();
    button.click();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(tooltip.matches(':popover-open')).toBeFalse();
  });

  it('closes when scrolling, resizing, losing focus or destroying the customer card', () => {
    button.click();
    window.dispatchEvent(new Event('scroll'));
    expect(tooltip.matches(':popover-open')).toBeFalse();
    button.click();
    window.dispatchEvent(new Event('resize'));
    expect(tooltip.matches(':popover-open')).toBeFalse();
    button.dispatchEvent(new FocusEvent('focus'));
    button.dispatchEvent(new FocusEvent('blur'));
    expect(tooltip.matches(':popover-open')).toBeFalse();
    button.click();
    fixture.destroy();
    expect(tooltip.matches(':popover-open')).toBeFalse();
  });
});
