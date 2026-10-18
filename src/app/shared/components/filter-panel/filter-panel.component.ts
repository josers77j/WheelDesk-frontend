import { Component, input, output, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-filter-panel',
  templateUrl: './filter-panel.component.html',
  styleUrl: './filter-panel.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class FilterPanelComponent {
  readonly hasAdditional = input(false);
  readonly hasSearch = input(true);
  readonly heading = input('Consultar registros');
  readonly expanded = input(false);
  readonly expandedChange = output<boolean>();
}
