import { Component, computed, input, output } from '@angular/core';

export interface QueryError {
  message?: string;
  status?: number | null;
}

/**
 * Estado de error para listados con TanStack Query.
 *
 * Al usuario no le importa el código exacto: solo necesita saber si el
 * problema viene del servidor o de la aplicación, y que pida ayuda.
 */
@Component({
  selector: 'app-query-error',
  imports: [],
  templateUrl: './query-error.component.html',
})
export class QueryErrorComponent {
  error = input<QueryError | null>(null);
  showReset = input<boolean>(true);

  retry = output<void>();
  resetFilters = output<void>();

  private status = computed(() => this.error()?.status ?? 0);

  /** true = falló el servidor o la red; false = algo raro de la app. */
  isServerError = computed(() => {
    const status = this.status();
    return status === 0 || status >= 500;
  });

  title = computed(() =>
    this.isServerError()
      ? 'No pudimos cargar la información'
      : 'Algo no salió bien en la aplicación',
  );

  description = computed(() =>
    this.isServerError()
      ? 'El servidor no pudo responder esta vez. Revisa tu conexión e inténtalo de nuevo.'
      : 'La aplicación envió algo que el servidor no entendió. Prueba limpiando los filtros.',
  );

  originLabel = computed(() =>
    this.isServerError()
      ? 'Origen: servidor'
      : 'Origen: aplicación',
  );
}
