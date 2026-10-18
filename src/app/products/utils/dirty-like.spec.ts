import { FormControl, FormGroup } from '@angular/forms';
import { buildDirtyLike } from './dirty-like';

describe('Product dirty payload', () => {
  it('sends only dirty changed fields and preserves explicit clearing', () => {
    const form = new FormGroup({ name: new FormControl(''), price: new FormControl(15), notes: new FormControl('unchanged') });
    form.controls.name.markAsDirty();
    form.controls.price.markAsDirty();
    form.controls.notes.markAsDirty();
    const result = buildDirtyLike({ form, originalSnapshot: { name: 'Old', price: 10, notes: 'unchanged' }, isEditing: true, keys: ['name', 'price', 'notes'], buildCreateLike: () => ({}) });
    expect(result).toEqual({ name: null, price: 15 });
  });

  it('keeps feature post-processing and creation payloads', () => {
    const form = new FormGroup({ name: new FormControl('New') });
    const create = () => ({ name: 'New' });
    expect(buildDirtyLike({ form, originalSnapshot: null, isEditing: false, keys: ['name'], buildCreateLike: create })).toEqual({ name: 'New' });
    expect(buildDirtyLike<{ name: string; providerId: number | null }>({ form, originalSnapshot: {}, isEditing: true, keys: [], buildCreateLike: create, postProcess: (like) => { like['providerId'] = null; } })).toEqual({ providerId: null });
  });
});
