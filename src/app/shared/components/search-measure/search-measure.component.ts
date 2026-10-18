import { Component, input, linkedSignal, output } from '@angular/core';

@Component({
    selector: 'app-search-measure',
    imports: [],
    templateUrl: './search-measure.component.html',
})
export class SearchMeasureComponent {
    outputWidthValue = output<string | null>();
    initialWidthValue = input<number | null>();

    widthValue = linkedSignal(() => this.initialWidthValue())
    onWidthChange(value: string): void {
        this.widthValue.set(+value);
        this.outputWidthValue.emit(value);
    }

    outputHeightValue = output<string | null>();
    initialHeightValue = input<number | null>();
    heightValue = linkedSignal(() => this.initialHeightValue())
    onHeightChange(value: string): void {
        this.heightValue.set(+value);
        this.outputHeightValue.emit(value);
    }

    outputRimValue = output<string | null>();
    initialRimValue = input<number | null>();
    rimValue = linkedSignal(() => this.initialRimValue())
    onRimChange(value: string): void {
        this.rimValue.set(+value);
        this.outputRimValue.emit(value);
    }

    /** Un solo limpiador para las 3 medidas. */
    clear(): void {
        this.widthValue.set(null);
        this.heightValue.set(null);
        this.rimValue.set(null);
        this.outputWidthValue.emit(null);
        this.outputHeightValue.emit(null);
        this.outputRimValue.emit(null);
    }

}
