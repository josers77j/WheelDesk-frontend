import { Pipe, type PipeTransform } from '@angular/core';

@Pipe({
  name: 'TaxPayer',
})
export class TaxPayerPipe implements PipeTransform {

  transform(value: unknown): string {
    return value ? 'Si': 'No';
  }

}
