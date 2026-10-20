export function purchaseInvoiceIdentity(source: string | null | undefined): string {
  if (!source) return '';
  const separator = source.indexOf(':');
  return separator >= 0 ? source.slice(separator + 1) : source;
}
