import { ValidatorFn } from '@angular/forms';

export function tireNumber(label: string, options: { integer?: boolean; positive?: boolean; min?: number; max?: number } = {}): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (value === null || value === undefined || value === '') return null;
    const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
    let message: string | undefined;
    if (!Number.isFinite(number)) message = `${label}: ingresa un número válido.`;
    else if (options.integer && !Number.isInteger(number)) message = `${label}: ingresa un número entero.`;
    else if (options.positive && number <= 0) message = `${label}: el valor debe ser mayor que cero.`;
    else if (options.min !== undefined && number < options.min) message = `${label}: el valor mínimo es ${options.min}.`;
    else if (options.max !== undefined && number > options.max) message = `${label}: el valor máximo es ${options.max}.`;
    return message ? { userValidation: message } : null;
  };
}

export function tireChoice(label: string, values: readonly unknown[], optional = false): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (optional && (value === null || value === undefined || value === '')) return null;
    return values.includes(value) ? null : { userValidation: `${label}: selecciona una opción válida.` };
  };
}
