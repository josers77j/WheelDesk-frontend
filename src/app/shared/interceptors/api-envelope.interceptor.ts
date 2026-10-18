import {
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable, map } from 'rxjs';

interface ApiEnvelope {
  data: unknown;
  message?: string;
}

export const apiEnvelopeInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> =>
  next(request).pipe(
    map((event) => {
      if (!(event instanceof HttpResponse)) return event;
      return unwrapResponse(event);
    }),
  );

function unwrapResponse<T>(response: HttpResponse<T>): HttpResponse<unknown> {
  const body = response.body;
  if (!isRecord(body) || !('data' in body)) return response;
  if ('meta' in body) return response;

  const envelope = body as unknown as ApiEnvelope;
  const data = envelope.data;

  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    return response.clone({
      body: {
        ...data,
        ...(envelope.message ? { message: envelope.message } : {}),
      },
    });
  }

  return response.clone({ body: data });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
