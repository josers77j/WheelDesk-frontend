import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import {
  AsYouType,
  CountryCode,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';

/**
 * Lista ligera de países (se puede ampliar). El valor del control se guarda
 * con formato E.164 sin guiones: "+503" + 8 dígitos (ej. +50371234567).
 * Los guiones/espacios se aplican SOLO en display (SV → XXXX-XXXX).
 */
const COUNTRIES: CountryCode[] = ['SV', 'GT', 'HN', 'NI', 'CR', 'PA', 'BZ', 'US', 'MX'];

@Component({
  selector: 'app-phone-input',
  standalone: true,
  imports: [],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneInputComponent),
      multi: true,
    },
  ],
  templateUrl: './phone-input.component.html',
})
export class PhoneInputComponent implements ControlValueAccessor, OnDestroy {
  defaultCountry = input<CountryCode>('SV');

  @ViewChild('countryBtn')
  private countryBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('countryPanel')
  private countryPanel?: ElementRef<HTMLUListElement>;
  @ViewChild('countryPanelHome')
  private countryPanelHome?: ElementRef<HTMLDivElement>;

  country = signal<CountryCode>('SV');
  digits = signal('');
  countryOpen = signal(false);
  isDisabled = false;

  private readonly regionNames = new Intl.DisplayNames(['es'], {
    type: 'region',
  });

  private onChange: ((value: string | null) => void) | null = null;
  private onTouched: (() => void) | null = null;

  callingCode = computed(() => `+${getCountryCallingCode(this.country())}`);
  /** Máximo de caracteres visibles en el input (incluye separadores). */
  maxlength = computed(() => (this.country() === 'SV' ? 9 : 16));
  /** Máximo de dígitos nacionales según país (SV = 8). */
  private maxDigits = computed(() => (this.country() === 'SV' ? 8 : 15));

  /** Display con máscara: SV → XXXX-XXXX; otros países con AsYouType. */
  display = computed(() => {
    const d = this.digits();
    if (!d) return '';
    const country = this.country();
    if (country === 'SV') {
      const n = d.length > 4 ? d.slice(0, 4) + '-' + d.slice(4) : d;
      return n;
    }
    // Formato "as you type" para el resto de países
    return new AsYouType(country).input(d);
  });

  countries = COUNTRIES.map((code) => ({
    code,
    callingCode: `+${getCountryCallingCode(code)}`,
    name: this.countryName(code),
  }));

  constructor(private readonly elementRef: ElementRef) {}

  countryName(code: CountryCode): string {
    try {
      return this.regionNames.of(code) ?? code;
    } catch {
      return code;
    }
  }

  // ---------- Menú de países ----------
  toggleCountryMenu(): void {
    if (this.isDisabled) return;
    if (this.countryOpen()) {
      this.closeCountryMenu();
      return;
    }
    this.countryOpen.set(true);
    // Portal al <dialog> (o body): el listado flota sobre el modal sin ser
    // recortado por el overflow del modal-box.
    queueMicrotask(() => this.portalCountryPanel());
  }

  selectCountry(code: CountryCode): void {
    this.country.set(code);
    this.closeCountryMenu();
    this.emitValue();
  }

  closeCountryMenu(): void {
    this.countryOpen.set(false);
    queueMicrotask(() => this.unportalCountryPanel());
  }

  private portalCountryPanel(): void {
    const panel = this.countryPanel?.nativeElement;
    if (!panel) return;
    if (!this.countryOpen()) {
      this.unportalCountryPanel();
      return;
    }
    const host =
      (this.countryBtn?.nativeElement?.closest?.(
        'dialog',
      ) as HTMLElement | null) ?? document.body;
    if (panel.parentElement !== host) {
      host.appendChild(panel);
    }
    this.repositionCountryPanel();
    window.addEventListener('scroll', this.onWindowChange, true);
    window.addEventListener('resize', this.onWindowChange);
  }

  /** Posiciona el listado JUSTO debajo del botón del código de país. */
  private repositionCountryPanel(): void {
    const button = this.countryBtn?.nativeElement;
    const panel = this.countryPanel?.nativeElement;
    if (!button || !panel || !this.countryOpen()) return;
    const rect = button.getBoundingClientRect();
    const width = Math.max(rect.width, 224);
    panel.style.position = 'fixed';
    panel.style.top = `${rect.bottom + 6}px`;
    panel.style.left = `${Math.max(
      8,
      Math.min(rect.left, window.innerWidth - width - 8),
    )}px`;
    panel.style.width = `${width}px`;
    panel.style.maxHeight = `${Math.max(
      Math.min(window.innerHeight - rect.bottom - 12, 320),
      160,
    )}px`;
    panel.style.overflowY = 'auto';
    panel.style.zIndex = '9999';
  }

  private unportalCountryPanel(): void {
    const panel = this.countryPanel?.nativeElement;
    const home = this.countryPanelHome?.nativeElement;
    window.removeEventListener('scroll', this.onWindowChange, true);
    window.removeEventListener('resize', this.onWindowChange);
    if (panel) {
      panel.style.position = '';
      panel.style.top = '';
      panel.style.left = '';
      panel.style.width = '';
      panel.style.maxHeight = '';
      panel.style.overflowY = '';
      panel.style.zIndex = '';
    }
    if (panel && home && panel.parentElement !== home) {
      home.appendChild(panel);
    }
  }

  private onWindowChange = () => this.repositionCountryPanel();

  // Cierra el menú al hacer click fuera — PERO no cuenta como "fuera" el
// panel portaleado al <dialog>: sin este check, el pointerdown sobre un
// item cerraba el menú antes del click y la selección nunca llegaba.
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: MouseEvent): void {
    const target = event.target as Node | null;
    const inHost =
      !!target && this.elementRef.nativeElement.contains(target);
    const inPanel =
      !!target &&
      !!this.countryPanel?.nativeElement &&
      this.countryPanel.nativeElement.contains(target);
    if (!inHost && !inPanel && this.countryOpen()) {
      this.closeCountryMenu();
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onWindowChange, true);
    window.removeEventListener('resize', this.onWindowChange);
    const panel = this.countryPanel?.nativeElement;
    const home = this.countryPanelHome?.nativeElement;
    if (panel && home && panel.parentElement !== home) {
      home.appendChild(panel);
    }
  }

  // ---------- ControlValueAccessor ----------
  writeValue(value: string | null | undefined): void {
    const raw = value ?? '';
    if (!raw) {
      this.digits.set('');
      this.country.set(this.defaultCountry());
      return;
    }
    const parsed = parsePhoneNumberFromString(
      raw.trim(),
      this.defaultCountry(),
    );
    if (parsed?.isValid()) {
      this.country.set(parsed.country ?? this.defaultCountry());
      this.digits.set(parsed.nationalNumber);
    } else {
      // Legacy: sin prefijo → asumir country por defecto
      const digitsOnly = raw.replace(/\D/g, '').slice(0, 15);
      this.country.set(this.defaultCountry());
      this.digits.set(digitsOnly);
    }
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  // ---------- Handlers ----------
  onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.digits.set(raw.replace(/\D/g, '').slice(0, this.maxDigits()));
    this.emitValue();
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    const parsed = parsePhoneNumberFromString(text, this.country());
    const national = parsed?.nationalNumber ?? text.replace(/\D/g, '');
    this.digits.set(national.slice(0, this.maxDigits()));
    this.emitValue();
  }

  private emitValue(): void {
    const digits = this.digits();
    const callingCode = getCountryCallingCode(this.country());
    this.onChange?.(digits ? `+${callingCode}${digits}` : null);
    this.onTouched?.();
  }
}