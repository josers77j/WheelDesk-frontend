import { Customer } from '../interfaces/customer.interface';

/**
 * Campos faltantes del cliente migrado (vacío = completo, sin warning).
 * Solo aplica a contribuyentes: un no contribuyente no tiene datos fiscales
 * que completar, así que nunca se le marca como incompleto.
 *
 * Vive acá (y no en `customer-table`) porque el warning se muestra en más de
 * un lugar: la tabla de clientes y la fila resumen del checkout de ventas.
 */
export function customerMissingFields(
  customer: Customer | null | undefined,
): string[] {
  if (!customer?.isTaxPayer) return [];

  const missing: string[] = [];
  if (!customer.taxInfo?.nrc) missing.push('NRC');
  // La actividad sirve solo si trae código: las actividades "legacy" del
  // catálogo migrating quedan con `code = null` (columna nullable en Prisma),
  // así que el código cubre también ese caso.
  if (!customer.taxInfo?.economicActivity?.code) missing.push('actividad económica');
  if (!customer.taxInfo?.tradeName) missing.push('nombre comercial');
  // El tipo de documento vale si llega la relación o el id: el listado y el
  // detalle lo traen embebido, pero un payload migrado puede solo traer el id.
  if (
    !customer.taxInfo?.taxDocumentType &&
    !customer.taxInfo?.taxDocumentTypeId
  ) {
    missing.push('tipo de documento');
  }
  if (!customer.address) missing.push('dirección');
  if (!customer.districtId) missing.push('distrito');
  return missing;
}

/** Texto del tooltip del warning: "Faltan: NRC, dirección, ...". */
export function customerMissingFieldsTip(
  customer: Customer | null | undefined,
): string {
  return `Faltan: ${customerMissingFields(customer).join(', ')}`;
}
