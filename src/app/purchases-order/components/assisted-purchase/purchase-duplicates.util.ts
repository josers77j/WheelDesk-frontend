import Decimal from 'decimal.js';
import { PurchaseNewProduct, PurchaseRowDraft } from '../../interfaces/assisted-purchase.interface';

function canonical(value: unknown, key = ''): unknown {
  if (Array.isArray(value)) {
    const items = value.map(item => canonical(item));
    return key === 'vehicleTypeId' ? items.sort((a, b) => String(a).localeCompare(String(b))) : items;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .filter(([, item]) => item !== undefined && item !== null && item !== '' && !(Array.isArray(item) && item.length === 0))
      .map(([name, item]) => [name, canonical(item, name)]));
  }
  if ((key === 'salePrice' || key === 'purchasePrice' || key === 'unitPrice') &&
    (typeof value === 'string' || typeof value === 'number')) {
    try { return new Decimal(value).toString(); } catch { return value; }
  }
  if (typeof value === 'string' && key === 'name') return value.trim().replace(/\s+/g, ' ').toUpperCase();
  return value;
}

export function productWithPurchaseCost(product: PurchaseNewProduct, cost: string): PurchaseNewProduct {
  return { ...product,
    ...(product.tire ? { tire: { ...product.tire, purchasePrice: String(cost) } } : {}),
    ...(product.supply ? { supply: { ...product.supply, purchasePrice: String(cost) } } : {}),
  };
}

export function duplicatePurchaseProducts(rows: readonly PurchaseRowDraft[]): number[][] {
  const groups = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const identity = row.choice === 'existing' && row.productId
      ? { productId: row.productId }
      : row.choice === 'new' && row.ready && row.product ? { product: { ...productWithPurchaseCost(row.product, row.unitPrice), ...(row.brandName.trim() ? { brandId: undefined, brand: { name: row.brandName } } : {}) } } : null;
    const key = identity ? JSON.stringify(canonical({ ...identity, unitPrice: row.unitPrice, suggestedZoneId: row.suggestedZoneId })) : null;
    if (!key) return;
    const group = groups.get(key);
    if (group) group.push(index + 1);
    else groups.set(key, [index + 1]);
  });
  return [...groups.values()].filter(group => group.length > 1);
}
