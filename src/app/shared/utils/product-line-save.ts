/** Save a product line after feature validation, preserving duplicate checks and selected indices. */
import { AbstractControl } from '@angular/forms';

export type ProductLineSaveResult =
  | 'saved'
  | 'invalid'
  | 'duplicate'
  | 'aborted';

export interface SaveProductLineParams<TLine> {
  productForm: AbstractControl;
  selectedIndex: number | null;
  guard?: () => boolean;
  buildLine: (selectedIndex: number | null) => TLine | null;
  isDuplicate: (line: TLine, selectedIndex: number | null) => boolean;
  duplicateMessage: string;
  add: (line: TLine) => void;
  update: (index: number, line: TLine) => void;
  showError: (message: string) => void;
}

export function saveProductLine<TLine>(
  params: SaveProductLineParams<TLine>,
): ProductLineSaveResult {
  const {
    productForm,
    selectedIndex,
    guard,
    buildLine,
    isDuplicate,
    duplicateMessage,
    add,
    update,
    showError,
  } = params;

  productForm.markAllAsTouched();
  productForm.markAsDirty();
  if (!productForm.dirty) return 'invalid';
  if (productForm.invalid) return 'invalid';

  if (guard && !guard()) return 'aborted';

  const line = buildLine(selectedIndex);
  if (line === null) return 'aborted';

  if (isDuplicate(line, selectedIndex)) {
    showError(duplicateMessage);
    return 'duplicate';
  }

  if (selectedIndex === null) {
    add(line);
  } else {
    update(selectedIndex, line);
  }

  return 'saved';
}
