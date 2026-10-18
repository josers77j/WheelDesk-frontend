import { Pipe, type PipeTransform } from '@angular/core';

@Pipe({
  name: 'CorrelativeParse',
})
export class CorrelativeParsePipe implements PipeTransform {

  transform(value: number): string {

    const assignCorrelative = String(value).padStart(6, '0')

    return assignCorrelative;
    ;
  }

}
