import { QueryClient } from '@tanstack/angular-query-experimental';

/**
 * Refresca los cachés de los combobox (misma página, sin recargar).
 * Llamar en onSuccess de crear/editar/eliminar catálogos: marcas,
 * proveedores, productos, bodegas/zonas y clientes.
 */
export function invalidateCatalogCaches(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['brand-combobox'] });
  queryClient.invalidateQueries({ queryKey: ['provider-combobox'] });
  queryClient.invalidateQueries({ queryKey: ['product-combobox'] });
  queryClient.invalidateQueries({ queryKey: ['zone-combobox'] });
  queryClient.invalidateQueries({ queryKey: ['warehouse-combobox'] });
  queryClient.invalidateQueries({ queryKey: ['customer-combobox'] });
}
