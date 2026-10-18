import { Pipe, PipeTransform } from '@angular/core';
import {
  CountryCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';

/**
 * Pipe de display para teléfonos.
 * Entrada tolerante: "+50371234567", "71234567" o "7123-4567".
 * Salida: SV → "+503 7123-4567" (guion tras el 4º dígito);
 * otros países → formato internacional de libphonenumber-js.
 */
@Pipe({ name: 'phoneFormat', standalone: true })
export class PhoneFormatPipe implements PipeTransform {
  transform(
    value: string | null | undefined,
    country: CountryCode = 'SV',
  ): string {
    const raw = (value ?? '').trim();
    if (!raw) return '';

    const parsed = parsePhoneNumberFromString(raw, country);
    if (parsed?.isValid()) {
      const national = parsed.nationalNumber;
      if (parsed.country === 'SV') {
        const hyphenated =
          national.length > 4
            ? national.slice(0, 4) + '-' + national.slice(4)
            : national;
        return `+${parsed.countryCallingCode} ${hyphenated}`;
      }
      return parsed.formatInternational();
    }

    // Fallback para datos legacy sin "+": formatar dígitos como SV
    const digits = raw.replace(/\D/g, '');
    if (country === 'SV' && digits.length === 8) {
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    return raw;
  }
}