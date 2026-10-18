import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { Provider } from '../interfaces/provider.interface';
import { FormUtils } from '../../shared/utils/form-utils';

const identifier: ValidatorFn = control => {
  const value: unknown = control.value;
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'string' && (!value.trim() || /^\d{1,30}$/.test(value.replace(/[\s-]/g, '')))
    ? null : { userValidation: 'Ingrese entre 1 y 30 dígitos; puede usar espacios y guiones.' };
};
const email: ValidatorFn = control => {
  const value: unknown = control.value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  return Validators.email(new FormControl(text)) || !/^[^@]+@[^@]+\.[^@]+$/.test(text)
    ? { email: true } : null;
};
const phone: ValidatorFn = control => {
  const value: unknown = control.value;
  if (typeof value !== 'string' || !value.trim()) return null;
  return /^\+?[\d ()-]+$/.test(value.trim()) ? FormUtils.phoneValidator()(control)
    : { userValidation: 'Ingrese un teléfono válido, sin letras ni símbolos adicionales.' };
};
export function createProviderForm() {
  return new FormGroup({
    name: new FormControl('', [Validators.required, Validators.minLength(2)]),
    description: new FormControl(''),
    nrc: new FormControl('', identifier), nit: new FormControl('', identifier),
    phone: new FormControl('', phone), email: new FormControl('', [email, Validators.maxLength(254)]),
  });
}
export type ProviderForm = ReturnType<typeof createProviderForm>;
export function resetProviderForm(form: ProviderForm, provider: Partial<Provider> = {}): void {
  form.reset({ name: provider.name ?? '', description: provider.description ?? '',
    nrc: provider.nrc ?? '', nit: provider.nit ?? '', phone: provider.phone ?? '', email: provider.email ?? '' });
}
export function providerPayload(form: ProviderForm): Partial<Provider> {
  const value = form.getRawValue();
  const mail = value.email?.trim() || null;
  const at = mail?.lastIndexOf('@') ?? -1;
  return { name: value.name?.trim() || '', description: value.description?.trim() || '',
    nrc: value.nrc?.trim().replace(/[\s-]/g, '') || null,
    nit: value.nit?.trim().replace(/[\s-]/g, '') || null,
    phone: FormUtils.sanitizePhone(value.phone ?? ''),
    email: mail && at >= 0 ? mail.slice(0, at) + mail.slice(at).toLowerCase() : mail };
}
