import { Pipe, type PipeTransform } from '@angular/core';
import { ConstructionPipe } from './construction.pipe';
import { LoadRangePipe } from './load-range.pipe';
import { Tire, CONSTRUCTION, LOAD_RANGE } from '../interfaces/product.interface';

const constructionPipe = new ConstructionPipe();
const loadRangePipe = new LoadRangePipe();

@Pipe({
  name: 'TireDimensions',
})
export class TireDimensionsPipe implements PipeTransform {
  transform(tire: Tire | null | undefined): string {
    if (!tire) return '';

    const base = `${tire.prefix ?? ''}${tire.width ?? ''}/${
      tire.aspectRatio ?? ''
    }${constructionPipe.transform(tire.construction as CONSTRUCTION)}${tire.rimDiameter ?? ''}`;

    let suffix = '';
    if (tire.loadIndexFront != null) {
      suffix += ` ${tire.loadIndexFront}`;
      if (tire.loadIndexRear != null) {
        suffix += `/${tire.loadIndexRear}`;
      }
      if (tire.speedRating) {
        suffix += tire.speedRating;
      }
    }
    if (tire.loadRange != null) {
      const lr = String(tire.loadRange);
      if (lr !== '') {
        suffix += ` ${loadRangePipe.transform(lr as LOAD_RANGE)}`;
      }
    }

    return `${base}${suffix}`.trim();
  }
}