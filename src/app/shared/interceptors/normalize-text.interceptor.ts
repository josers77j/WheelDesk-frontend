import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Normalize human-entered text only; opaque identifiers and documents stay intact.
const textFields = new Set([
 'name', 'legalName', 'tradeName', 'customerName', 'providerName', 'productName',
 'description', 'notes', 'address', 'customerAddress', 'email', 'phone',
 'nit', 'nrc', 'documentNumber', 'taxDocumentNumber', 'filter', 'search',
]);

export function normalizeUserText(value: string): string {
 return Array.from(value.replace(/\r\n?/g, '\n'))
  .filter((character): boolean => {
   const code = character.charCodeAt(0);
   return code >= 32 && (code < 127 || code > 159) || character === '\n' || character === '\t';
  }).join('').trim();
}

function normalizeBody(value: unknown): unknown {
 if (Array.isArray(value)) return value.map((item: unknown): unknown => normalizeBody(item));
 if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value;
 const fields = Object.entries(value).map(([key, item]): [string, unknown] => {
  // Never descend into arbitrary invoice payloads, secrets or external metadata.
  if (['payload', 'raw', 'json', 'metadata', 'credentials'].includes(key)) return [key, item];
  if (typeof item === 'string' && textFields.has(key)) return [key, normalizeUserText(item)];
  return [key, typeof item === 'object' ? normalizeBody(item) : item];
 });
 return Object.fromEntries(fields);
}

function normalizeRequestBody(body: unknown, pathname: string): unknown {
 if (!(body instanceof FormData)) return normalizeBody(body);
 // This multipart field is an application form, not the original invoice file.
 if (!pathname.endsWith('/purchase-orders/assisted')) return body;
 const payload = body.get('payload');
 if (typeof payload !== 'string') return body;
 let parsed: unknown;
 try { parsed = JSON.parse(payload); } catch { return body; }
 const form = new FormData();
 for (const [key, value] of body.entries()) {
  form.append(key, key === 'payload' ? JSON.stringify(normalizeBody(parsed)) : value);
 }
 return form;
}

export const normalizeTextInterceptor: HttpInterceptorFn = (request, next) => {
 const base = new URL(environment.baseUrl);
 const url = new URL(request.url, base);
 if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname.replace(/\/$/, '') + '/')) return next(request);
 let params = request.params;
 for (const key of params.keys()) {
  const values = params.getAll(key);
  if (!values || !textFields.has(key)) continue;
  params = params.delete(key);
  for (const value of values) params = params.append(key, normalizeUserText(value));
 }
 for (const key of new Set(url.searchParams.keys())) {
  if (!textFields.has(key)) continue;
  const values = url.searchParams.getAll(key);
  url.searchParams.delete(key);
  for (const value of values) url.searchParams.append(key, normalizeUserText(value));
 }
 return next(request.clone({ url: url.href, params, body: normalizeRequestBody(request.body, url.pathname) }));
};
