import { HttpRequest } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { currentSvDay, reportRangeError } from '../../shared/utils/report-range';
import type { UserRole } from '../../users/interfaces/user.interface';

export interface PreflightError {
  status: number;
  message: string;
}

/** Reject known invalid API requests before the network transport is invoked. */
export function requestPreflight(
  request: HttpRequest<unknown>,
  role?: UserRole,
): PreflightError | null {
  const base = new URL(environment.baseUrl);
  const url = new URL(request.url, base);
  const prefix = base.pathname.replace(/\/$/, '');
  if (url.origin !== base.origin || !url.pathname.startsWith(`${prefix}/`))
    return null;
  const path = url.pathname.slice(prefix.length).replace(/\/$/, '');
  const error = (message: string, status = 400): PreflightError => ({
    message,
    status,
  });
  if (role && role !== 'ADMIN' && /^\/dashboard(\/|$)/.test(path))
    return error('No tienes permiso para consultar el resumen financiero.', 403);
  const publicAuth = ['/auth/login', '/auth/refresh-session'].includes(path);
  const accounting = ['/accounting-reports/period', '/accounting-reports/export'].includes(path);
  if (!publicAuth && role === 'ACCOUNTANT' && !accounting && !['/auth/profile', '/auth/logout'].includes(path))
    return error('Tu cuenta solo tiene acceso a reportes contables.', 403);
  if (accounting && role && !['ADMIN', 'ACCOUNTANT'].includes(role))
    return error('No tienes permiso para acceder a reportes contables.', 403);

  if (
    !publicAuth &&
    role &&
    role !== 'ADMIN' &&
    /^\/(users|company|audit|migration)(\/|$)/.test(path)
  )
    return error('No tienes permiso para acceder a esta sección.', 403);
  const viewerAllowed = ['/auth/logout', '/sale-orders/zip'].includes(path) || (accounting && role === 'ACCOUNTANT');
  if (
    role !== 'ADMIN' &&
    role !== 'SELLER' &&
    !['GET', 'HEAD'].includes(request.method) &&
    !publicAuth &&
    !viewerAllowed
  )
    return error(
      role === 'VIEWER'
        ? 'Tu cuenta tiene acceso de consulta. No puedes modificar registros.'
        : 'No se pudieron verificar tus permisos. Vuelve a iniciar sesión.',
      403,
    );
  const param = (name: string): string | null =>
    request.params.get(name) ?? url.searchParams.get(name);
  if (
    [
      '/dashboard/summary',
      '/sale-orders/zip',
      '/sale-orders/excel-summary',
    ].includes(path)
  ) {
    if (param('from') === '' || param('to') === '')
      return error('Selecciona fechas válidas.');
    const message = reportRangeError(param('from'), param('to'));
    if (message) return error(message);
  }

  if (path === '/accounting-reports/export') {
    if (!param('from') || !param('to')) return error('Selecciona ambas fechas.');
    const invalid = reportRangeError(param('from'), param('to'), 31);
    if (invalid) return error(invalid);
    if (param('to')! > currentSvDay()) return error('La fecha final no puede estar en el futuro.');
    const formats=(param('formats') ?? '').split(',');
    if (!formats.length || formats.some(format=>!['pdf','json','excel'].includes(format)) || new Set(formats).size!==formats.length) return error('Selecciona PDF, JSON o Excel.');
  }
  if (['/products/summary', '/warehouses/search-by-name'].includes(path)) {
    const limit = param('limit');
    if (
      limit !== null &&
      (!Number.isInteger(Number(limit)) ||
        Number(limit) < 1 ||
        Number(limit) > 100)
    )
      return error('Solicita entre 1 y 100 resultados.');
    const id = param(path === '/products/summary' ? 'zoneId' : 'productId');
    if (id !== null && (!Number.isInteger(Number(id)) || Number(id) < 1))
      return error('Selecciona una ubicación o producto válido.');
    const stock = param(
      path === '/products/summary' ? 'quantityStatus' : 'stockStatus',
    );
    if (stock !== null && !['ALL', 'IN_STOCK', 'OUT_OF_STOCK'].includes(stock))
      return error('Selecciona un filtro de existencias válido.');
    const type = path === '/products/summary' ? param('type') : null;
    if (type !== null && !['TIRE', 'SUPPLY', 'SERVICE'].includes(type))
      return error('Selecciona un tipo de producto válido.');
  }
  if (
    /^\/migration\/invoices\/(preview|import)$/.test(path) &&
    request.body instanceof FormData
  ) {
    const files = request.body.getAll('files');
    if (files.length > 400)
      return error('Selecciona como máximo 400 archivos por lote.');
    if (files.some((file) => file instanceof File && file.size > 512 * 1024))
      return error(
        'Cada archivo JSON o PDF debe pesar como máximo 512 KB.',
        413,
      );
  }
  return null;
}
