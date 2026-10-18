import { Component, effect, input, linkedSignal, output, signal } from '@angular/core';

const SEARCH_DEBOUNCE_MS = 1000;

@Component({
  selector: 'app-search',
  imports: [],
  templateUrl: './search.component.html',
})
export class SearchComponent {

  outputParam = output<string>();
  initialValue = input<string>();
  busy = input(false);
  readonly showButton = input(true);
  inputValue = linkedSignal(() => this.initialValue() ?? '')

  /** Solo true cuando el texto cambió por teclado (no por initialValue). */
  private typed = signal(false);
  /** Último valor emitido: si coincide, no se vuelve a pedir. */
  private lastEmitted = signal('');

  onType(value: string) {
    this.inputValue.set(value);
    this.typed.set(value !== this.lastEmitted());
  }

  emitNow(): void {
    if (this.busy()) return;
    const value = this.inputValue();
    this.typed.set(false);
    this.lastEmitted.set(value);
    this.outputParam.emit(value);
  }

  resetInput(): void {
    this.inputValue.set('');
    this.typed.set(false);
    this.lastEmitted.set('');
  }

  clear(): void {
    if (this.busy()) return;
    this.inputValue.set('');
    this.emitNow();
  }

  /**
   * Auto-busca 1000ms después de dejar de escribir. Emite una sola vez por
   * valor distinto (cero peticiones redundantes aunque la info esté cacheada).
   */
  autoSearchEffect = effect((onCleanup) => {
    const value = this.inputValue();
    if (this.busy() || !this.typed() || value === this.lastEmitted()) return;
    const timeout = setTimeout(() => {
      if (this.busy()) return;
      this.typed.set(false);
      this.lastEmitted.set(value);
      this.outputParam.emit(value);
    }, SEARCH_DEBOUNCE_MS);
    onCleanup(() => clearTimeout(timeout));
  });

}
