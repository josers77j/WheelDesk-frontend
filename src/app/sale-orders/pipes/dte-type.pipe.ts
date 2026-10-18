import { Pipe, type PipeTransform } from '@angular/core';

/**
 * Etiquetas legibles para el tipo de DTE. El usuario no habla en
 * códigos ("01"/"03"): habla de consumidor final y crédito fiscal.
 */
@Pipe({
  name: 'DteType',
})
export class DteTypePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    const labels: Record<string, string> = {
      '01': 'Consumidor final',
      FE: 'Consumidor final',
      '03': 'Crédito fiscal',
      CCFE: 'Crédito fiscal',
    };

    return labels[value ?? ''] ?? (value || '—');
  }
}
