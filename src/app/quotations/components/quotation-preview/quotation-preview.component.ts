import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { QuotationDetail } from '../../interfaces/quotation.interface';

@Component({
 selector: 'app-quotation-preview',
 imports: [CurrencyPipe, DatePipe],
 templateUrl: './quotation-preview.component.html',
})
export class QuotationPreviewComponent {
 readonly quotation = input.required<QuotationDetail>();
}
