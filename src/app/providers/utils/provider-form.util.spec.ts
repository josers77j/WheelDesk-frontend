import { createProviderForm, providerPayload, resetProviderForm } from './provider-form.util';

describe('Provider optional contacts', () => {
  it('normalizes contacts and clears blank optional fields', () => {
    const form = createProviderForm();
    resetProviderForm(form, { name: 'Proveedor', nrc: '338-1', phone: '7123-4567', email: ' Person@EXAMPLE.COM ' });
    expect(form.valid).toBeTrue();
    expect(providerPayload(form)).toEqual({ name: 'Proveedor', description: '', nrc: '3381', nit: null, phone: '+50371234567', email: 'Person@example.com' });
    resetProviderForm(form, { name: 'Otro' });
    expect(providerPayload(form).nrc).toBeNull();
    expect(providerPayload(form).phone).toBeNull();
  });
  it('rejects malformed identifiers, email and phone', () => {
    const form = createProviderForm();
    resetProviderForm(form, { name: 'Proveedor', nrc: '---', nit: 'abc', email: 'invalid', phone: '<b>71234567</b>' });
    for (const field of [form.controls.nrc, form.controls.nit, form.controls.email, form.controls.phone]) expect(field.invalid).toBeTrue();
  });
});
