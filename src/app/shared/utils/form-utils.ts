import {
  AbstractControl,
  FormArray,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  CountryCode,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';

async function sleep() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, 2500);
  });
}

export class FormUtils {
  // Expresiones regulares
  static readonly namePattern = '([a-zA-Z]+) ([a-zA-Z]+)';
  static readonly emailPattern = String.raw`^[a-zA-Z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$`;
  static readonly notOnlySpacesPattern = '^[a-zA-Z0-9]+$';
  static readonly slugPattern = '^[a-z0-9_]+(?:-[a-z0-9_]+)*$';

  static getTextError(errors: ValidationErrors) {
    for (const key of Object.keys(errors)) {
      switch (key) {
        case 'userValidation':
          return typeof errors['userValidation'] === 'string' ? errors['userValidation'] : 'Revisa el valor ingresado.';

        case 'required':
          return 'Este campo es requerido';

        case 'minlength':
          return `Mínimo de ${errors['minlength'].requiredLength} caracteres.`;

        case 'maxlength':
          return `Máximo de ${errors['maxlength'].requiredLength} caracteres.`;

        case 'min':
          return `Valor mínimo de ${errors['min'].min}`;

        case 'email':
          return `El valor ingresado no es un correo electrónico`;

        case 'emailTaken':
          return `El correo electrónico ya está siendo usado por otro usuario`;

        case 'noStrider':
          return `No se puede usar el username de strider en la app`;

        case 'noSelected':
          return `Es necesario elegir una opción`;

        case 'mustBeANumber':
          return `El campo debe contener números solamente`;

        case 'digitsOnly':
          return `El campo debe contener solo números, sin letras ni símbolos`;

        case 'invalidPhone': {
          // El ejemplo lo agrega el validador según el país del número
          const example = errors['invalidPhone']?.example as
            | string
            | undefined;
          return example
            ? `Ingresa un número de teléfono válido (ej. ${example})`
            : `Ingresa un número de teléfono válido`;
        }

        case 'pattern':
          if (errors['pattern'].requiredPattern === FormUtils.emailPattern) {
            return 'El valor ingresado no luce como un correo electrónico';
          }

          return 'Error de patrón contra expresión regular';

        default:
          return `Error de validación no controlado ${key}`;
      }
    }

    return null;
  }

  static isValidField(form: FormGroup, fieldName: string): boolean | null {
    return (
      !!form.controls[fieldName].errors && form.controls[fieldName].touched
    );
  }

  static getFieldError(form: FormGroup, fieldName: string): string | null {
    if (!form.controls[fieldName]) return null;

    const errors = form.controls[fieldName].errors ?? {};

    return FormUtils.getTextError(errors);
  }

  static hasChanges(form: FormGroup, originalValue: unknown): boolean {
    return (
      JSON.stringify(this.sortValue(form.getRawValue())) !==
      JSON.stringify(this.sortValue(originalValue))
    );
  }

  private static sortValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sortValue(item));
    if (typeof value !== 'object' || value === null) return value;
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = this.sortValue((value as Record<string, unknown>)[key]);
        return sorted;
      }, {});
  }

  static isValidFieldInArray(formArray: FormArray, index: number) {
    return (
      formArray.controls[index].errors && formArray.controls[index].touched
    );
  }

  static getFieldErrorInArray(
    formArray: FormArray,
    index: number,
  ): string | null {
    if (formArray.controls.length === 0) return null;

    const errors = formArray.controls[index].errors ?? {};

    return FormUtils.getTextError(errors);
  }

  static isFieldOneEqualFieldTwo(field1: string, field2: string) {
    return (formGroup: AbstractControl) => {
      const field1Value = formGroup.get(field1)?.value;
      const field2Value = formGroup.get(field2)?.value;

      return field1Value === field2Value ? null : { passwordsNotEqual: true };
    };
  }

  static async checkingServerResponse(
    control: AbstractControl,
  ): Promise<ValidationErrors | null> {
    await sleep(); // 2 segundos y medio

    const formValue = control.value;

    if (formValue === 'hola@mundo.com') {
      return {
        emailTaken: true,
      };
    }

    return null;
  }

  static notStrider(control: AbstractControl): ValidationErrors | null {
    const value = control.value;

    return value === 'strider' ? { noStrider: true } : null;
  }

  static noSelected(control: AbstractControl): ValidationErrors | null {
    const value = control.value;

    return value < 1 ? { noSelected: true } : null;
  }

  static noSelectedArray(control: AbstractControl): ValidationErrors | null {
    const value = control.value;

    return !value || value.length === 0 ? { noSelected: true } : null;
  }

  static mustBeANumber(control: AbstractControl): ValidationErrors | null {
    const isNotPhone = Number.isNaN(+control.value);

    return isNotPhone ? { mustBeANumber: true } : null;
  }

  /**
   * Ejemplos verificados con libphonenumber-js (getExampleNumber +
   * examples.mobile.json) para los países del selector del phone-input.
   * SV se muestra con guion (XXXX-XXXX) para ser consistente con la
   * máscara del input y el pipe de display.
   */
  private static readonly PHONE_EXAMPLES: Partial<
    Record<CountryCode, string>
  > = {
    SV: '7012-3456',
    GT: '5123 4567',
    HN: '9123-4567',
    NI: '8123 4567',
    CR: '8312 3456',
    PA: '6123-4567',
    BZ: '622-1234',
    US: '(201) 555-0123',
    MX: '222 123 4567',
  };

  /**
   * Valida un teléfono con libphonenumber-js.
   * El valor puede venir como E.164 ("+50371234567") o como dígitos locales.
   * Cuando el control está vacío NO marca error (los required se manejan
   * aparte según isTaxPayer).
   * El país se deduce del prefijo "+CC" del propio valor (el phone-input
   * siempre lo agrega), de modo que el mensaje de error muestra un ejemplo
   * del país correcto.
   */
  static phoneValidator(defaultCountry: CountryCode = 'SV') {
    return (control: AbstractControl): ValidationErrors | null => {
      const raw = String(control.value ?? '').trim();
      if (!raw) return null;

      const parsed = parsePhoneNumberFromString(raw, defaultCountry);
      if (parsed?.isValid()) return null;

      // País para el ejemplo: el que dedujo el parseo; si el calling code
      // coincide con el país por defecto (número local sin +), ese; si no,
      // mensaje genérico sin ejemplo.
      const country =
        parsed?.country ??
        (parsed &&
        parsed.countryCallingCode === getCountryCallingCode(defaultCountry)
          ? defaultCountry
          : undefined);

      const example = country
        ? FormUtils.PHONE_EXAMPLES[country]
        : undefined;

      return { invalidPhone: { example: example ?? '' } };
    };
  }

  /**
   * Sanitiza un teléfono a E.164 ("+503" + 8 dígitos) sin guiones.
   * Devuelve null si no hay dígitos. Entrada tolerante: "+50371234567",
   * "7123-4567", "71234567".
   */
  static sanitizePhone(
    value: string | null | undefined,
    defaultCountry: CountryCode = 'SV',
  ): string | null {
    const raw = (value ?? '').trim();
    if (!raw) return null;

    const parsed = parsePhoneNumberFromString(
      raw.startsWith('+') ? raw : `+${getCountryCallingCode(defaultCountry)}${raw.replace(/\D/g, '')}`,
      defaultCountry,
    );

    if (parsed?.isValid()) return parsed.number; // E.164: "+50371234567"

    // Si no es válido (p. ej. parcial al crear sin contribuyente), se
    // devuelve igualmente "+código+dígitos" limpio — el required/validador
    // se encarga de bloquear en los casos que corresponda.
    const digits = raw.replace(/\D/g, '').slice(0, 15);
    return digits ? `+${getCountryCallingCode(defaultCountry)}${digits}` : null;
  }

  /**
   * Validador condicional: exige valor solo cuando `condition()` es true.
   * Uso: `name: ['', [FormUtils.requiredIf(() => this.isTaxPayer())]]`
   */
  static requiredIf(condition: () => boolean) {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!condition()) return null;
      const value = control.value;
      const isEmpty =
        value === null ||
        value === undefined ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);
      return isEmpty ? { required: true } : null;
    };
  }

  /**
   * Requires digits only while the condition holds (e.g. NIT/DUI in the tax
   * document number). An empty value never fails: `required` is handled
   * separately, same convention as `requiredIf`.
   */
  static digitsOnlyIf(condition: () => boolean) {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!condition()) return null;
      const value = String(control.value ?? '').trim();
      if (!value) return null;

      return /^\d+$/.test(value) ? null : { digitsOnly: true };
    };
  }

  /**
   * Activa/desactiva `Validators.required` en una lista de controles
   * de un FormGroup y refresca su validez. Útil para el wizard de
   * customer (todo requerido cuando isTaxPayer === true).
   */
  static toggleRequired(
    form: FormGroup,
    fieldNames: string[],
    required: boolean,
  ): void {
    for (const fieldName of fieldNames) {
      const control = form.get(fieldName);
      if (!control) continue;
      if (required) {
        control.addValidators([Validators.required]);
      } else {
        control.removeValidators([Validators.required]);
      }
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  /** Max integer digits allowed in tire measurements (width, profile, rim). */
  static readonly MEASURE_MAX_INTEGER_DIGITS = 3;

  /** Max decimal digits allowed in tire measurements. */
  static readonly MEASURE_MAX_DECIMAL_DIGITS = 2;

  /**
   * Truncates a raw input value to `maxIntegerDigits` integer digits and
   * `maxDecimalDigits` decimals (e.g. "1954.567" -> "195.56"). The decimal
   * separator is kept while it is still being typed so the user can finish
   * the number.
   */
  static limitDigits(
    value: string,
    maxIntegerDigits: number,
    maxDecimalDigits: number,
  ): string {
    const [integerPart = '', ...decimalParts] = value
      .replace(/[^\d.]/g, '')
      .split('.');
    const integers = integerPart.slice(0, maxIntegerDigits);
    const decimals = decimalParts.join('').slice(0, maxDecimalDigits);

    return decimalParts.length === 0 ? integers : `${integers}.${decimals}`;
  }

  /**
   * Applies the tire measurement limit while typing. It fixes the DOM value
   * and the form control together because `type="number"` inputs report
   * numbers, so writing the control as a string would break the payload.
   */
  static restrictMeasureDigits(
    control: AbstractControl | null,
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;
    const limited = FormUtils.limitDigits(
      input.value,
      FormUtils.MEASURE_MAX_INTEGER_DIGITS,
      FormUtils.MEASURE_MAX_DECIMAL_DIGITS,
    );

    if (limited === input.value) return;

    input.value = limited;
    control?.setValue(limited === '' ? null : Number(limited));
  }
}
