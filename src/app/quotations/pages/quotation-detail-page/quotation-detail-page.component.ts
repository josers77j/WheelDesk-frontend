import { QuotationPreviewComponent } from '../../components/quotation-preview/quotation-preview.component';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { injectQuery } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { QuotationDocumentActionsComponent } from '../../components/quotation-document-actions/quotation-document-actions.component';
import { QuotationService } from '../../services/quotation.service';
import { AlertComponent } from '../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-quotation-detail-page',
  imports: [QuotationPreviewComponent, RouterLink, AlertComponent, QuotationDocumentActionsComponent],
  templateUrl: './quotation-detail-page.component.html',
})
export class QuotationDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(QuotationService);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly id = computed((): number => Number(this.params().get('id')));
  readonly validId = computed(
    (): boolean => Number.isSafeInteger(this.id()) && this.id() > 0,
  );
  readonly quotation = injectQuery(() => ({
    queryKey: ['quotation', this.id()],
    queryFn: () => firstValueFrom(this.service.getQuotation(this.id())),
    enabled: this.validId(),
    staleTime: 1000 * 60 * 5,
  }));

}
