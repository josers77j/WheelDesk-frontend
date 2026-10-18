import {
    Component,
    ElementRef,
    OnDestroy,
    ViewChild,
    computed,
    effect,
    input,
    linkedSignal,
    output,
    signal,
} from "@angular/core";
import { ValueParams } from "../combobox/interfaces/search-param.interface";

@Component({
    selector: "app-combobox-form-control",
    imports: [],
    templateUrl: "./combobox-form-control.component.html",
})
export class ComboboxFormControlComponent implements OnDestroy {
    constructor(private readonly elementRef: ElementRef) {
        document.addEventListener(
            "pointerdown",
            this.onDocumentPointerDown as EventListener,
        );
    }

    // this values fill the list
    valuesResource = input.required<ValueParams[]>();
    valuesOutput = output<ValueParams | null>();

    searchTextInput = input<string>();
    searchText = linkedSignal(() => this.searchTextInput() ?? "");
    searchTextChange = output<string>();
    loading = input<boolean>(false);
    isSearching = signal(false);

    selectedValue = input<ValueParams | null>();

    namePrefixSeparator = input<string>('');

    displayValue = computed(() => {
        const value = this.selectedValue();
        return value ? { ...value, name: this.displayName(value.name) } : value;
    });

    displayName(name: string): string {
        const separator = this.namePrefixSeparator();
        const index = separator ? name.indexOf(separator) : -1;
        return index >= 0 ? name.slice(index + separator.length).trim() : name;
    }

    placeholderInput = input.required<string>();

    disable = input<boolean>();

    isError = input<boolean>();
    isOpen = signal(false);

    @ViewChild("anchor") private anchor?: ElementRef<HTMLElement>;
    @ViewChild("panelHome") private panelHome?: ElementRef<HTMLElement>;
    @ViewChild("panel") private panel?: ElementRef<HTMLElement>;

    private portalTarget: HTMLElement | null = null;
    private selectionClosePending = false;
    private readonly cancelSelectionPointerDown = () => {
        if (this.selectionClosePending) this.cancelSelectionClose();
    };
    private readonly stopSelectionPointerUp = (event: Event) => {
        event.stopPropagation();
    };
    private readonly stopSelectionClick = (event: Event) => {
        if (!this.selectionClosePending) return;
        event.stopPropagation();
        event.preventDefault();
        this.finishSelectionClose();
    };
    private onWindowChange = () => this.repositionPanel();
    private beginSelectionClose() {
        if (this.selectionClosePending) return;
        this.selectionClosePending = true;
        document.addEventListener('pointerdown', this.cancelSelectionPointerDown, true);
        document.addEventListener('pointerup', this.stopSelectionPointerUp, true);
        document.addEventListener('click', this.stopSelectionClick, true);
    }

    private finishSelectionClose() {
        this.cancelSelectionClose();
        this.isOpen.set(false);
        this.unportalPanel();
    }

    private cancelSelectionClose() {
        this.selectionClosePending = false;
        document.removeEventListener('pointerdown', this.cancelSelectionPointerDown, true);
        document.removeEventListener('pointerup', this.stopSelectionPointerUp, true);
        document.removeEventListener('click', this.stopSelectionClick, true);
    }

    private layoutObserver: ResizeObserver | null = null;

    private observeLayout() {
        this.unobserveLayout();
        const anchor = this.anchor?.nativeElement;
        if (!anchor || typeof ResizeObserver === "undefined") return;
        this.layoutObserver = new ResizeObserver(() => this.onWindowChange());
        this.layoutObserver.observe(anchor);
    }

    private unobserveLayout() {
        this.layoutObserver?.disconnect();
        this.layoutObserver = null;
    }
    private dialogCloseHandler: (() => void) | null = null;
    private dialogCloseHost: HTMLElement | null = null;

    toggleDropdown() {
        this.cancelSelectionClose();
        const willOpen = !this.isOpen();
        this.isOpen.set(willOpen);
        // Al cerrar el panel vuelve a casa ya; al abrir se portalea.
        // Ambas ramas son síncronas: sin microtasks que se reordenen.
        if (!willOpen) {
            this.unportalPanel();
            return;
        }
        this.portalPanel();
    }

    // En táctil el dedo micro-mueve y el navegador suprime el click;
    // el pointerup sí llega siempre. La bandera evita el doble toggle
    // (pointerup + click posterior) en mouse y taps limpios.
    private pointerToggleArmed = false;

    onTogglePointerUp() {
        if (this.disable()) return;
        this.pointerToggleArmed = true;
        // Si el click posterior nunca llega (suprimido por micro-scroll),
        // la bandera no debe comerse el próximo toggle.
        setTimeout(() => (this.pointerToggleArmed = false), 350);
        this.toggleDropdown();
    }

    onToggleClick() {
        if (this.disable()) return;
        if (this.pointerToggleArmed) {
            this.pointerToggleArmed = false;
            return;
        }
        this.toggleDropdown();
    }

    setValue(value: ValueParams | null) {
        this.valuesOutput.emit(value);
        // Elegir no es buscar: limpiar el texto tras la selección solo servía
        // para disparar searchTextChange("") -> el padre cambia su queryKey
        // en CADA selección, y con él la reconciliación del panel: la lista
        // vuelve a pedirse y, si llega, resultsEffect reposiciona el panel
        // justo cuando se está cerrando. El texto vacío ya está en pantalla;
        // se silencia esa única emisión. Solo si el texto realmente cambia: si
        // ya era "", linkedSignal no emite y una bandera pendiente se comería
        // la próxima búsqueda real del usuario.
        // El ahorro de red es marginal: con staleTime de 5 min, quitar la
        // emisión casi siempre solo evita un refetch que la caché ya cubría.
        if (this.searchText() !== "") {
            this.suppressNextSearchEmit = true;
        }
        this.searchText.set("");
        this.isSearching.set(false);
        if (value === null) {
            this.cancelSelectionClose();
            this.isOpen.set(false);
            this.unportalPanel();
            return;
        }
        this.beginSelectionClose();
    }

    onSearchInput(value: string) {
        this.searchText.set(value);
        this.isSearching.set(true);
    }

    /** La primera emisión (montaje) se salta: nadie ha interactuado. */
    private skipFirstSearchEmit = true;

    /** Silencia la emisión del texto limpio tras una selección (ver setValue). */
    private suppressNextSearchEmit = false;

    debounceEffect = effect((onCleanup) => {
        const value = this.searchText();
        if (this.skipFirstSearchEmit) {
            this.skipFirstSearchEmit = false;
            return;
        }
        if (this.suppressNextSearchEmit) {
            this.suppressNextSearchEmit = false;
            return;
        }
        const timeout = setTimeout(() => {
            this.searchTextChange.emit(value);
        }, 300);
        onCleanup(() => {
            clearTimeout(timeout);
        });
    });

    resetCombobox() {
        this.cancelSelectionClose();
        // Al reabrir debe verse la lista completa: si el texto había quedado
        // con filtro, este reset sí tiene que avisar al padre. Se descarta
        // cualquier supresión pendiente de una selección anterior para que
        // no se trague esta emisión.
        this.suppressNextSearchEmit = false;
        this.searchText.set("");
        this.isSearching.set(false);
        this.isOpen.set(false);
        this.unportalPanel();
    }

    loadingEffect = effect(() => {
        if (!this.loading()) {
            this.isSearching.set(false);
        }

        if (!this.searchText() && this.isSearching()) {
            this.isSearching.set(false);
        }

        if (
            this.isSearching() &&
            !this.loading() &&
            (this.valuesResource() ?? []).length === 0
        ) {
            this.isSearching.set(false);
        }
    });

    // Al llegar resultados el panel crece: recalcular arriba/abajo.
    resultsEffect = effect(() => {
        const count = (this.valuesResource() ?? []).length;
        if (this.isOpen() && count !== this.lastResultCount) {
            this.lastResultCount = count;
            this.repositionPanel();
        }
    });
    private lastResultCount = -1;

    // close combobox when click outside (incluye el panel portaleado al dialog)
    private onDocumentPointerDown = (event: MouseEvent) => {
        const target = event.target as Node | null;
        const inAnchor =
            !!target &&
            !!this.anchor?.nativeElement &&
            this.anchor.nativeElement.contains(target);
        const inPanel =
            !!target &&
            !!this.panel?.nativeElement &&
            this.panel.nativeElement.contains(target);
        if (!inAnchor && !inPanel) {
            this.isOpen.set(false);
            this.unportalPanel();
        }
    };

    private portalPanel() {
        this.cancelSelectionClose();
        const panel = this.panel?.nativeElement;
        if (!panel) return;
        if (!this.isOpen()) {
            this.unportalPanel();
            return;
        }
        // Destino: el <dialog> abierto más cercano (queda por encima del modal-box
        // con su propio stacking) o el body como fallback fuera de modales.
        const host =
            (this.anchor?.nativeElement?.closest?.(
                "dialog",
            ) as HTMLElement | null) ?? document.body;
        if (panel.parentElement !== host) {
            host.appendChild(panel);
        }
        this.portalTarget = host;
        this.attachDialogCloseListener(host);
        // Síncrono como el combobox de filtros: el ancla siempre es medible
        // y la posición queda lista antes del primer pintado (sin saltos).
        this.repositionPanel();
        window.addEventListener("scroll", this.onWindowChange, true);
        window.addEventListener("resize", this.onWindowChange);
        // El ancla se mueve sin scroll: teclado, contenido que crece, zoom.
        // Observar layout, no eventos. Solo el ancla: observar document.body
        //.convertía cualquier cambio de layout de la app en un reflow forzado
        // (lecturas + escrituras de estilo) y en un bucle con el panel
        // portaleado, que vive en ese mismo body.
        this.observeLayout();
        window.visualViewport?.addEventListener("resize", this.onWindowChange);
        window.visualViewport?.addEventListener("scroll", this.onWindowChange);
    }

    private repositionPanel() {
        const anchor = this.anchor?.nativeElement;
        const panel = this.panel?.nativeElement;
        if (!anchor || !panel || !this.isOpen()) return;
        const rect = anchor.getBoundingClientRect();
        // El panel mide lo mismo que el input: alineado a la izquierda siempre,
        // sin importar zoom o columna angosta (el min-width fijo lo desplazaba).
        const width = Math.min(Math.max(rect.width, 160), window.innerWidth - 16);
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        const spaceBelow = window.innerHeight - rect.bottom - 12;
        const spaceAbove = rect.top - 12;
        // El lado con más espacio gana: si abajo no cabe cómodamente
        // pero arriba sí, nace arriba (sin umbrales mágicos).
        const openUp = spaceAbove > spaceBelow;
        const maxHeight = Math.min(
            openUp ? spaceAbove : spaceBelow,
            320,
        );
        panel.style.position = "fixed";
        panel.style.left = `${left}px`;
        if (openUp) {
            panel.style.top = "auto";
            panel.style.bottom = `${window.innerHeight - rect.top + 4}px`;
        } else {
            panel.style.bottom = "auto";
            panel.style.top = `${rect.bottom + 4}px`;
        }
        panel.style.width = `${width}px`;
        panel.style.maxHeight = `${Math.max(maxHeight, 80)}px`;
        panel.style.overflowY = "auto";
        panel.style.zIndex = "9999";
    }

    private unportalPanel() {
        const panel = this.panel?.nativeElement;
        const home = this.panelHome?.nativeElement;
        this.detachDialogCloseListener();
        window.removeEventListener("scroll", this.onWindowChange, true);
        window.removeEventListener("resize", this.onWindowChange);
        window.visualViewport?.removeEventListener("resize", this.onWindowChange);
        window.visualViewport?.removeEventListener("scroll", this.onWindowChange);
        this.unobserveLayout();
        if (panel) {
            panel.style.position = "";
            panel.style.left = "";
            panel.style.top = "";
            panel.style.bottom = "";
            panel.style.width = "";
            panel.style.maxHeight = "";
            panel.style.overflowY = "";
            panel.style.zIndex = "";
        }
        if (panel && home && panel.parentElement !== home) {
            home.appendChild(panel);
        }
        this.portalTarget = null;
    }

    /**
     * Si el dropdown queda abierto y el <dialog> se cierra sin click previo
     * (tecla Escape o .close() programático), el evento 'close' —que no
     * burbujea— resetea el combobox para que no reaparezca abierto.
     */
    private attachDialogCloseListener(host: HTMLElement) {
        this.detachDialogCloseListener();
        if (host.tagName !== 'DIALOG') return;
        this.dialogCloseHost = host;
        this.dialogCloseHandler = () => this.resetCombobox();
        host.addEventListener('close', this.dialogCloseHandler);
    }

    private detachDialogCloseListener() {
        if (this.dialogCloseHost && this.dialogCloseHandler) {
            this.dialogCloseHost.removeEventListener(
                'close',
                this.dialogCloseHandler,
            );
        }
        this.dialogCloseHost = null;
        this.dialogCloseHandler = null;
    }

    ngOnDestroy() {
        this.cancelSelectionClose();
        this.detachDialogCloseListener();
        document.removeEventListener(
            "pointerdown",
            this.onDocumentPointerDown as EventListener,
        );
        window.removeEventListener("scroll", this.onWindowChange, true);
        window.removeEventListener("resize", this.onWindowChange);
        window.visualViewport?.removeEventListener("resize", this.onWindowChange);
        window.visualViewport?.removeEventListener("scroll", this.onWindowChange);
        this.unobserveLayout();
        // Si el componente se destruye con el panel portaleado, devolverlo
        // para no dejar nodos huérfanos dentro del dialog.
        const panel = this.panel?.nativeElement;
        const home = this.panelHome?.nativeElement;
        if (panel && home && panel.parentElement !== home) {
            home.appendChild(panel);
        }
    }
}
