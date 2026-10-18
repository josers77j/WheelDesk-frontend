import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { QuotationSummary } from '../../interfaces/quotation.interface';
@Component({ selector: 'app-quotation-table', imports: [CurrencyPipe, DatePipe], templateUrl: './quotation-table.component.html' })
export class QuotationTableComponent {
  readonly quotations = input.required<QuotationSummary[]>();
  readonly selectedId = input<number>(0);
  readonly rowOffset = input<number>(0);
  readonly selected = output<number>();
}
