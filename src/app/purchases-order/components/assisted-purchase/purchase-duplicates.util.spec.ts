import { PurchaseRowDraft } from '../../interfaces/assisted-purchase.interface';
import { duplicatePurchaseProducts } from './purchase-duplicates.util';

function row(): PurchaseRowDraft {
  return { key: crypto.randomUUID(), description: 'Insumo', quantity: 1, unitPrice: '10',
    choice: 'new', type: 'SUPPLY', brandName: 'Marca', selected: null, ready: true,
    product: { type: 'SUPPLY', brand: { name: 'MARCA' }, supply: { name: 'Aceite', salePrice: '15', unitOfMeasureCatalogId: 1 } } };
}

describe('Duplicate products within a purchase', () => {
  it('groups existing IDs independently of quantity but respects different destinations', () => {
    const first = { ...row(), choice: 'existing', productId: 7 } satisfies PurchaseRowDraft;
    const second = { ...first, key: crypto.randomUUID(), quantity: 3 };
    const rows = [first, { ...first, productId: 8 }, second];
    const snapshot = JSON.stringify(rows);
    expect(duplicatePurchaseProducts(rows)).toEqual([[1, 3]]);
    expect(JSON.stringify(rows)).toBe(snapshot);
    expect(duplicatePurchaseProducts([first, { ...second, suggestedZoneId: 9 }])).toEqual([]);
  });
  it('compares complete new products and normalizes name case and numeric price representation', () => {
    const first = row();
    const second = { ...row(), product: { supply: { salePrice: '15.00', name: ' aceite ', unitOfMeasureCatalogId: 1 }, brand: { name: 'marca' }, type: 'SUPPLY' } } satisfies PurchaseRowDraft;
    expect(duplicatePurchaseProducts([first, second])).toEqual([[1, 2]]);
    second.product.supply.unitOfMeasureCatalogId = 2;
    expect(duplicatePurchaseProducts([first, second])).toEqual([]);
  });
  it('treats empty optional data equally but distinguishes a single populated optional value', () => {
    const first = row();
    const second = { ...row(), product: { ...row().product, type: 'SUPPLY', supply: { ...row().product?.supply, notes: null } } } satisfies PurchaseRowDraft;
    expect(duplicatePurchaseProducts([first, second])).toEqual([[1, 2]]);
    const different = { ...second, product: { ...second.product, supply: { ...second.product.supply, notes: 'Distinto' } } };
    expect(duplicatePurchaseProducts([first, different])).toEqual([]);
  });
  it('detects equal tire drafts when numeric inputs produce numbers in one and strings in the other', () => {
    const first = row();
    const second = row();
    // Numeric value accessors can emit numbers despite the string-shaped API model.
    Object.assign(first, { unitPrice: 25, product: { type: 'TIRE', brand: { name: 'AUSTONE' }, tire: { notes: '', salePrice: 26, purchasePrice: 25, itemTypeCatalogId: 1, unitOfMeasureCatalogId: 35, tire: { prefix: '', width: 225, aspectRatio: 50, construction: 'RADIAL', rimDiameter: 15, loadRange: '', plies: 0, condition: 'NEW', quality: 'A', vehicleTypeId: [2] } } } });
    Object.assign(second, { unitPrice: '25', product: { type: 'TIRE', brand: { name: 'AUSTONE' }, tire: { notes: '', salePrice: 26, purchasePrice: '25', itemTypeCatalogId: 1, unitOfMeasureCatalogId: 35, tire: { prefix: '', width: 225, aspectRatio: 50, construction: 'RADIAL', rimDiameter: 15, loadRange: '', plies: 0, condition: 'NEW', quality: 'A', vehicleTypeId: [2] } } } });
    expect(duplicatePurchaseProducts([first, second])).toEqual([[1, 2]]);
  });
  it('compares the final purchase cost instead of an empty or outdated draft cost', () => {
    const first = row();
    const second = { ...row(), product: { type: 'SUPPLY', brand: { name: 'MARCA' }, supply: { name: 'Aceite', salePrice: '15', unitOfMeasureCatalogId: 1, purchasePrice: '' } } } satisfies PurchaseRowDraft;
    expect(duplicatePurchaseProducts([first, second])).toEqual([[1, 2]]);
  });
  it('does not flag incomplete drafts, distinct prices or a new draft against an existing ID', () => {
    const first = row();
    expect(duplicatePurchaseProducts([first, { ...row(), ready: false }])).toEqual([]);
    expect(duplicatePurchaseProducts([first, { ...row(), product: { ...first.product, supply: { name: 'Aceite', salePrice: '16', unitOfMeasureCatalogId: 1 }, type: 'SUPPLY' } }])).toEqual([]);
    expect(duplicatePurchaseProducts([first, { ...row(), choice: 'existing', productId: 7 }])).toEqual([]);
  });
});
