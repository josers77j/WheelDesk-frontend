import { Component, ElementRef, OnDestroy, computed, input, signal, viewChild } from '@angular/core';

let nextTooltipId = 0;

@Component({
  selector: 'app-customer-missing-info',
  template: `
    <button #trigger type="button" class="btn btn-ghost btn-xs btn-circle text-warning"
      aria-label="Información faltante del cliente" [attr.aria-describedby]="visible() ? tooltipId : null"
      (mouseenter)="show()" (mouseleave)="hide()" (focus)="show()" (blur)="hide()"
      (click)="onClick($event)">
      <span class="icon-[tabler--alert-triangle] text-lg" aria-hidden="true"></span>
    </button>
    <div #tooltip [id]="tooltipId" popover="manual" role="tooltip"
      class="fixed m-0 border-0 rounded-box bg-neutral text-neutral-content px-3 py-2 text-sm shadow-lg w-max whitespace-normal break-words"
      style="inset: auto; pointer-events: none; z-index: 100; overflow: auto; box-sizing: border-box;">
      {{ message() }}
    </div>
  `,
})
export class CustomerMissingInfoComponent implements OnDestroy {
  readonly fields = input.required<readonly string[]>();
  readonly message = computed(() => 'Faltan: ' + this.fields().join(', '));
  readonly visible = signal(false);
  readonly tooltipId = 'customer-missing-info-' + ++nextTooltipId;
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly tooltip = viewChild<ElementRef<HTMLElement>>('tooltip');
  private readonly onScroll = (): void => this.hide();
  private readonly onKeydown = (event: KeyboardEvent): void => { if (event.key === 'Escape') this.hide(); };
  private readonly onOutside = (event: Event): void => {
    const target = event.target;
    if (target instanceof Node && !this.trigger()?.nativeElement.contains(target)) this.hide();
  };

  onClick(event: Event): void {
    event.stopPropagation();
    this.show();
  }

  show(): void {
    const trigger = this.trigger()?.nativeElement;
    const tooltip = this.tooltip()?.nativeElement;
    if (!trigger || !tooltip || this.visible()) return;
    if (typeof tooltip.showPopover !== 'function') {
      trigger.title = this.message();
      return;
    }
    const width = document.documentElement.clientWidth || window.innerWidth;
    const height = document.documentElement.clientHeight || window.innerHeight;
    tooltip.style.maxWidth = Math.max(1, Math.min(320, width - 16)) + 'px';
    tooltip.style.maxHeight = Math.max(1, height - 16) + 'px';
    tooltip.style.overflowWrap = 'anywhere';
    tooltip.showPopover();
    const anchor = trigger.getBoundingClientRect();
    const bounds = tooltip.getBoundingClientRect();
    const left = Math.max(8, Math.min(anchor.left + anchor.width / 2 - bounds.width / 2, width - bounds.width - 8));
    const above = anchor.top - bounds.height - 8;
    const top = above >= 8 ? above : Math.max(8, Math.min(anchor.bottom + 8, height - bounds.height - 8));
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    this.visible.set(true);
    window.addEventListener('scroll', this.onScroll, true);
    window.addEventListener('resize', this.onScroll);
    document.addEventListener('pointerdown', this.onOutside, true);
    document.addEventListener('keydown', this.onKeydown, true);
  }

  hide(): void {
    const tooltip = this.tooltip()?.nativeElement;
    if (tooltip && typeof tooltip.hidePopover === 'function' && tooltip.matches(':popover-open')) tooltip.hidePopover();
    this.visible.set(false);
    window.removeEventListener('scroll', this.onScroll, true);
    window.removeEventListener('resize', this.onScroll);
    document.removeEventListener('pointerdown', this.onOutside, true);
    document.removeEventListener('keydown', this.onKeydown, true);
  }

  ngOnDestroy(): void {
    this.hide();
  }
}
