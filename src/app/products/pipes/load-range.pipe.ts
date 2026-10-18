import { Pipe, type PipeTransform } from '@angular/core';
import { LOAD_RANGE } from '../interfaces/product.interface';

@Pipe({
  name: 'LoadRange',
})
export class LoadRangePipe implements PipeTransform {
  transform(value: LOAD_RANGE | '' | undefined | null): string {
    if (!value) return '';

    const loadRange: Record<LOAD_RANGE, string> = {
      REINFORCED: 'C',
      EXTRA_LOAD: 'XL',
    };

    return loadRange[value];
  }
}