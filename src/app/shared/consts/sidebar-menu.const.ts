export interface SidebarMenuItem {
  title: string;
  /** Sin path = próximamente (se muestra deshabilitado). */
  path?: string;
  icon: string;
  exact?: boolean;
  adminOnly?: boolean;
}

export interface SidebarMenuGroup {
  id: string;
  label: string;
  icon: string;
  items: SidebarMenuItem[];
}

/**
 * Sidebar agrupado por áreas. Todos los iconos son de la misma familia
 * (tabler, estilo outline) para un patrón visual coherente:
 * - Personas: usuarios = grupo, clientes = libreta (no se confunden).
 * - Documentos: compra = factura de proveedor, venta = recibo,
 *   cotización = archivo con monto.
 * Zonas no es un módulo propio: vive dentro del detalle de cada Bodega
 * (igual que en el backend), y Empresa vive en el dropdown del topbar
 * por ser configuración única, no un CRUD operativo.
 */
export const SIDEBAR_GROUPS: SidebarMenuGroup[] = [
  {
    id: 'general',
    label: 'General',
    icon: 'icon-[tabler--home]',
    items: [
      {
        title: 'dashboard',
        path: '',
        icon: 'icon-[tabler--dashboard]',
        exact: true,
      },
    ],
  },
  {
    id: 'catalogo',
    label: 'Catálogo',
    icon: 'icon-[tabler--tags]',
    items: [
      {
        title: 'Productos',
        path: 'products',
        icon: 'icon-[tabler--package]',
      },
      {
        title: 'Marcas',
        path: 'brands',
        icon: 'icon-[tabler--award]',
      },
    ],
  },
  {
    id: 'compras',
    label: 'Compras',
    icon: 'icon-[tabler--shopping-cart]',
    items: [
      {
        title: 'Proveedores',
        path: 'providers',
        icon: 'icon-[tabler--truck-delivery]',
      },
      {
        title: 'Ordenes de compra',
        path: 'purchase-orders',
        icon: 'icon-[tabler--file-invoice]',
      },
    ],
  },
  {
    id: 'inventario',
    label: 'Inventario',
    icon: 'icon-[tabler--boxes]',
    items: [
      {
        title: 'Bodegas',
        path: 'warehouses',
        icon: 'icon-[tabler--building-warehouse]',
      },
      {
        title: 'Transferencias',
        path: 'transfers',
        icon: 'icon-[tabler--arrows-exchange]',
      },
    ],
  },
  {
    id: 'ventas',
    label: 'Ventas',
    icon: 'icon-[tabler--currency-dollar]',
    items: [
      {
        title: 'Clientes',
        path: 'customers',
        icon: 'icon-[tabler--address-book]',
      },
      // Próximos módulos: al crear la ruta, basta agregarles `path`
      // y aparecen solos en el sidebar (expandido y contraído).
      {
        title: 'Órdenes de venta',
        path: 'sale-orders',
        icon: 'icon-[tabler--receipt]',
      },
      {
        title: 'Cotizaciones',
        path: 'quotations',
        icon: 'icon-[tabler--file-dollar]',
      },
    ],
  },
  {
    id: 'administracion',
    label: 'Administración',
    icon: 'icon-[tabler--settings]',
    items: [
      {
        title: 'Usuarios',
        path: 'users',
        adminOnly: true,
        icon: 'icon-[tabler--users]',
      },
      {
        title: 'Auditoría',
        path: 'audit',
        adminOnly: true,
        icon: 'icon-[tabler--shield-check]',
      },
      {
        title: 'Migración',
        path: 'migration',
        adminOnly: true,
        icon: 'icon-[tabler--database-import]',
      },
    ],
  },
];
