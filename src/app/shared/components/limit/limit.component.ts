import { Component, input, output, signal } from '@angular/core';


@Component({
  selector: 'app-limit',
  imports: [],
  templateUrl: './limit.component.html',
})
export class LimitComponent {
    limitList = signal<number[]>([10, 20, 50, 100]);
    limitInput = input.required<number>();
    outputLimit = output<number>();


}
