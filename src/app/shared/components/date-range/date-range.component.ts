import { Component, input, output } from '@angular/core';

type CalendarTarget = 'from' | 'to';

@Component({
  selector: 'app-date-range',
  imports: [],
  templateUrl: './date-range.component.html',
})
export class DateRangeComponent {
  readonly fromChange = output<string>();
  readonly toChange = output<string>();

  readonly fromSelected = input<string | null>();
  readonly toSelected = input<string | null>();

  onDateChange(target: CalendarTarget, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (target === 'from') {
      this.fromChange.emit(value);
    } else {
      this.toChange.emit(value);
    }
  }
}
