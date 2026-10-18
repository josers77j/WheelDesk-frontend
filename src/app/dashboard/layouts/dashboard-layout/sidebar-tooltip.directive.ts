import { Directive, ElementRef, HostListener, OnDestroy, input } from '@angular/core';

/**
 * Tooltip portaleado al <body>: los tooltips CSS de daisyUI se recortan
 * porque `.drawer-side` siempre tiene `overflow: hidden`, así que este
 * tooltip se pinta fuera del sidebar (position: fixed) y nunca se corta.
 */
@Directive({
  selector: '[appSidebarTooltip]',
  standalone: true,
})
export class SidebarTooltipDirective implements OnDestroy {
  text = input('', { alias: 'appSidebarTooltip' });

  private tooltipEl: HTMLElement | null = null;
  private onScroll = () => this.hide();

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  @HostListener('mouseenter')
  onEnter() {
    this.show();
  }

  @HostListener('mouseleave')
  onLeave() {
    this.hide();
  }

  @HostListener('focus')
  onFocus() {
    this.show();
  }

  @HostListener('blur')
  onBlur() {
    this.hide();
  }

  ngOnDestroy() {
    this.hide();
  }

  private show() {
    const label = this.text();
    if (!label || this.tooltipEl) return;

    const rect = this.host.nativeElement.getBoundingClientRect();
    const el = document.createElement('div');
    el.textContent = label;
    el.className =
      'fixed z-[100] pointer-events-none px-2 py-1 text-sm rounded bg-neutral text-neutral-content shadow-lg whitespace-nowrap';
    el.style.left = `${rect.right + 8}px`;
    el.style.top = `${rect.top + rect.height / 2}px`;
    el.style.transform = 'translateY(-50%)';
    document.body.appendChild(el);
    this.tooltipEl = el;
    window.addEventListener('scroll', this.onScroll, true);
    window.addEventListener('resize', this.onScroll);
  }

  private hide() {
    this.tooltipEl?.remove();
    this.tooltipEl = null;
    window.removeEventListener('scroll', this.onScroll, true);
    window.removeEventListener('resize', this.onScroll);
  }
}
