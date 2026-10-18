import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  imports: [],
  templateUrl: './skeleton.component.html',
})
export class SkeletonComponent {

    limit = input.required<number>()
    skeletonElements = computed(() => new Array(this.limit()).fill(0));
}
