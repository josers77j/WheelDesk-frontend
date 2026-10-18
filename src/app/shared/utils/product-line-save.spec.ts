import { FormControl, FormGroup, Validators } from '@angular/forms';
import { saveProductLine } from './product-line-save';

describe('Product line save workflow', () => {
  function setup() {
    return { productForm: new FormGroup({ quantity: new FormControl(1, Validators.required) }), selectedIndex: null as number | null, buildLine: () => ({ id: 1 }), isDuplicate: (): boolean => false, duplicateMessage: 'Duplicado', add: jasmine.createSpy('add'), update: jasmine.createSpy('update'), showError: jasmine.createSpy('showError') };
  }
  it('blocks invalid, guarded and duplicate lines without modifying details', () => {
    const params = setup();
    params.productForm.controls.quantity.setValue(null);
    expect(saveProductLine(params)).toBe('invalid');
    params.productForm.controls.quantity.setValue(1);
    expect(saveProductLine({ ...params, guard: () => false })).toBe('aborted');
    expect(saveProductLine({ ...params, isDuplicate: () => true })).toBe('duplicate');
    expect(params.showError).toHaveBeenCalledOnceWith('Duplicado');
    expect(params.add).not.toHaveBeenCalled();
    expect(params.update).not.toHaveBeenCalled();
  });
  it('adds a new line and updates the original selected index', () => {
    const params = setup();
    expect(saveProductLine(params)).toBe('saved');
    expect(params.add).toHaveBeenCalledOnceWith({ id: 1 });
    expect(saveProductLine({ ...params, selectedIndex: 2 })).toBe('saved');
    expect(params.update).toHaveBeenCalledOnceWith(2, { id: 1 });
  });
});
