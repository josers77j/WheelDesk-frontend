import { purchaseInvoiceIdentity } from './purchase-invoice-identity';

describe('Purchase invoice identity display', (): void => {
  it('removes the supplier prefix and preserves the complete code', (): void => {
    expect(purchaseInvoiceIdentity('123456:ABC-123')).toBe('ABC-123');
    expect(purchaseInvoiceIdentity(':ABC-123')).toBe('ABC-123');
    expect(purchaseInvoiceIdentity('ABC-123')).toBe('ABC-123');
    expect(purchaseInvoiceIdentity(null)).toBe('');
  });
});
