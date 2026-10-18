import { afterRenderEffect, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { AlertService } from './alert.service';

@Component({
  selector: 'app-alert',
  imports: [],
  templateUrl: './alert.component.html',
})
export class AlertComponent {
  alertService = inject(AlertService);

  private readonly host = this.alertService.registerHost();

  alerts = computed(() =>
    this.alertService.activeHost() === this.host ? this.alertService.alerts() : [],
  );

  private readonly document = inject(DOCUMENT);
  readonly overlay = viewChild<ElementRef<HTMLElement>>('alertOverlay');
  private home: ParentNode | null = null;

  constructor() {
    const observer = new MutationObserver((): void => this.promoteOverlay());
    observer.observe(this.document.documentElement, { subtree: true, attributes: true, attributeFilter: ['open'] });
    const onClose = (): void => this.promoteOverlay();
    this.document.addEventListener('close', onClose, true);
    afterRenderEffect((): void => {
      this.alerts();
      this.promoteOverlay();
    });
    inject(DestroyRef).onDestroy((): void => {
      observer.disconnect();
      this.document.removeEventListener('close', onClose, true);
      this.overlay()?.nativeElement.remove();
    });
    inject(DestroyRef).onDestroy((): void => this.alertService.unregisterHost(this.host));
  }

  private promoteOverlay(): void {
    const overlay = this.overlay()?.nativeElement;
    if (!overlay || !this.alerts().length) return;
    this.home ??= overlay.parentNode;
    const modals = this.document.querySelectorAll<HTMLDialogElement>('dialog:modal');
    const target = modals.item(modals.length - 1) ?? this.home;
    if (target && overlay.parentNode !== target) target.appendChild(overlay);
    if (overlay.isConnected) {
      if (overlay.matches(':popover-open')) overlay.hidePopover();
      overlay.showPopover();
    }
  }

  isLeaving = (id: number): boolean => this.alertService.leavingIds().has(id);

  alertStyle = signal({
    success: 'alert-success',
    error: 'alert-error',
    warning: 'alert-warning',
  });

  dismiss(id: number): void {
    this.alertService.dismiss(id);
  }
}
