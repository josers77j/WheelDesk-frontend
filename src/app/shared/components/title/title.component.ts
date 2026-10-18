import { Component, input } from '@angular/core';

@Component({
  selector: 'app-title',
  imports: [],
  templateUrl: './title.component.html',
})
export class TitleComponent {
  titleDetail = input<{name: string, count?: number}>({ name: '', count: 0});
}
