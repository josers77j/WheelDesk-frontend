import { Component, effect, input, linkedSignal, output, signal, HostListener, ElementRef, computed, OnDestroy, ViewChild } from '@angular/core';
import { ValueParams } from './interfaces/search-param.interface';


@Component({
    selector: 'app-combobox',
    imports: [],
    templateUrl: './combobox.component.html',

})
export class ComboboxComponent implements OnDestroy {

    constructor(private readonly elementRef: ElementRef) {}

    private dialogCloseHandler: (() => void) | null = null;
    private dialogCloseHost: HTMLElement | null = null;
    private unportalTimer: ReturnType<typeof setTimeout> | null = null;
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

    ngOnDestroy() {
        this.cancelSelectionClose();
        if (this.unportalTimer) clearTimeout(this.unportalTimer);
        this.unportalTimer = null;
        if (this.dialogCloseHost && this.dialogCloseHandler) {
            this.dialogCloseHost.removeEventListener(
                'close',
                this.dialogCloseHandler,
            );
        }
        this.dialogCloseHost = null;
        this.dialogCloseHandler = null;
        window.removeEventListener("scroll", this.onWindowChange, true);
        window.removeEventListener("resize", this.onWindowChange);
        const panel = this.panel?.nativeElement;
        const home = this.panelHome?.nativeElement;
        if (panel && home && panel.parentElement !== home) {
            home.appendChild(panel);
        }
    }

    private portalPanel() {
        this.cancelSelectionClose();
        if (this.unportalTimer) clearTimeout(this.unportalTimer);
        this.unportalTimer = null;
        const panel = this.panel?.nativeElement;
        if (!panel) return;
        if (!this.isOpen()) {
            this.unportalPanel();
            return;
        }
        // Destino: el <dialog> abierto más cercano o el body como fallback
        // (en filtros no hay dialog: el panel flota sobre el contenido).
        const host =
            (this.anchor?.nativeElement?.closest?.(
                "dialog",
            ) as HTMLElement | null) ?? document.body;
        if (panel.parentElement !== host) {
            host.appendChild(panel);
        }
        this.portalTarget = host;
        this.attachDialogCloseListener(host);
        this.repositionPanel();
        window.addEventListener("scroll", this.onWindowChange, true);
        window.addEventListener("resize", this.onWindowChange);
    }

    private repositionPanel() {
        const anchor = this.anchor?.nativeElement;
        const panel = this.panel?.nativeElement;
        if (!anchor || !panel || !this.isOpen()) return;
        const rect = anchor.getBoundingClientRect();
        const width = Math.max(rect.width, 240);
        const spaceBelow = window.innerHeight - rect.bottom - 12;
        const spaceAbove = rect.top - 12;
        // Umbral fijo de 200px: abre abajo si hay espacio suficiente.
        // Solo sube si hay genuinamente poco espacio abajo y más arriba.
        const desired = 200;
        const fitsBelow = spaceBelow >= desired;
        const openUp = !fitsBelow && spaceAbove > spaceBelow;
        const maxHeight = Math.min(
            openUp ? spaceAbove : spaceBelow,
            320,
        );
        panel.style.position = "fixed";
        panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
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
        if (this.unportalTimer) clearTimeout(this.unportalTimer);
        this.unportalTimer = null;
        const panel = this.panel?.nativeElement;
        const home = this.panelHome?.nativeElement;
        this.detachDialogCloseListener();
        window.removeEventListener("scroll", this.onWindowChange, true);
        window.removeEventListener("resize", this.onWindowChange);
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

    private hasHydrated = false;


    // this values fill the list
    valuesResource = input.required<ValueParams[]>()
    valuesOutput = output<ValueParams | null>();
    internalValue = signal<ValueParams | null>(null);

    searchTextInput = input<string>()
    searchText = linkedSignal(() => (this.searchTextInput() ?? ''))
    searchTextChange = output<string>()

    selectedValue = input<ValueParams | null>();

   displayValue = computed(() => this.internalValue())
    placeholderInput = input.required<string>()

    isError = input<boolean>()
    isOpen = signal(false);
    toggleDropdown() {
        this.isOpen.update(state => !state);
        queueMicrotask(() => this.portalPanel());
    }

    @ViewChild("anchor") private anchor?: ElementRef<HTMLElement>;
    @ViewChild("panelHome") private panelHome?: ElementRef<HTMLElement>;
    @ViewChild("panel") private panel?: ElementRef<HTMLElement>;

    private portalTarget: HTMLElement | null = null;
    private onWindowChange = () => this.repositionPanel();

    initValueEffect = effect(()=> {

        if(this.hasHydrated) return ;

        const externalValue = this.selectedValue();

        if(!externalValue) return ;

        this.internalValue.set(externalValue)
        this.hasHydrated = true
    })
        // close combobox when click outside
    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
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
            this.cancelSelectionClose();
            this.isOpen.set(false);
            this.scheduleUnportal();
        }
    }

    setValue(value: ValueParams | null) {
        this.internalValue.set(value)
        this.valuesOutput.emit(value)
        this.searchText.set('')
        if (value === null) {
            this.cancelSelectionClose();
            this.isOpen.set(false);
            this.unportalPanel();
            return;
        }
        this.beginSelectionClose();
    }

    resetCombobox() {
        this.cancelSelectionClose();
        this.searchText.set('')
        this.isOpen.set(false);
        this.unportalPanel();
    }


    /** La primera emisión (montaje) se salta: nadie ha interactuado. */
    private skipFirstSearchEmit = true;

    debounceEffect = effect((onCleanup) => {
        const value = this.searchText();
        if (this.skipFirstSearchEmit) {
            this.skipFirstSearchEmit = false;
            return;
        }
        const timeout = setTimeout(() => {
            this.searchTextChange.emit(value)
        }, 400);
        onCleanup(() => {
            clearTimeout(timeout)
        })
    })

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

    private scheduleUnportal() {
        if (this.unportalTimer) clearTimeout(this.unportalTimer);
        this.unportalTimer = setTimeout(() => {
            this.unportalTimer = null;
            this.unportalPanel();
        }, 0);
    }

    loading = input<boolean>()



}
