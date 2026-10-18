import { FormControl } from '@angular/forms';
import { tireChoice, tireNumber } from './tire-validators';

describe('Tire backend-aligned validators', (): void => {
  it('rejects profile outside 25–95 and decimals', (): void => {
    const control = new FormControl(20, tireNumber('Perfil', { integer: true, min: 25, max: 95 }));
    expect(control.errors?.['userValidation']).toContain('25');
    for (const value of [96, 25.5]) { control.setValue(value); expect(control.invalid).toBeTrue(); }
    for (const value of [25, 95]) { control.setValue(value); expect(control.valid).toBeTrue(); }
  });
  it('allows empty optional provider and rejects zero', (): void => {
    const control = new FormControl<number | null>(null, tireNumber('Proveedor', { integer: true, positive: true }));
    expect(control.valid).toBeTrue(); control.setValue(0); expect(control.invalid).toBeTrue();
    control.setValue(1); expect(control.valid).toBeTrue();
  });
  it('allows decimal rims but rejects zero and nonnumeric input', (): void => {
    const control = new FormControl('17.5', tireNumber('Rin', { positive: true }));
    expect(control.valid).toBeTrue(); control.setValue('0'); expect(control.invalid).toBeTrue();
    control.setValue('abc'); expect(control.invalid).toBeTrue();
  });
  it('checks optional selections', (): void => {
    const control = new FormControl('', tireChoice('Índice de velocidad', ['H'], true));
    expect(control.valid).toBeTrue(); control.setValue('I'); expect(control.invalid).toBeTrue();
    control.setValue('H'); expect(control.valid).toBeTrue();
  });
});
