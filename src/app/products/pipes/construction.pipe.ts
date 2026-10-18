import { Pipe, type PipeTransform } from '@angular/core';
import { CONSTRUCTION } from '../interfaces/product.interface';

@Pipe({
  name: 'Construction',
})
export class ConstructionPipe implements PipeTransform {
  transform(value: CONSTRUCTION | undefined | null): string {
    if (!value) return '';

    const construction: Record<CONSTRUCTION, string> = {
      RADIAL: 'R',
      BIAS: 'D',
      BELTED: 'B',
    };

    return construction[value];
  }
}