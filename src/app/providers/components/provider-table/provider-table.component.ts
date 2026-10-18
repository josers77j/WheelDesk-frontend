import { Component, inject, Input, signal } from '@angular/core';
import { Provider } from '../../interfaces/provider.interface';
import { ProviderService } from '../../services/provider.service';
import { DatePipe } from '@angular/common';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-provider-table',
  imports: [DatePipe, SkeletonComponent],
  templateUrl: './provider-table.component.html',
})
export class ProviderTableComponent {
  @Input({ required: true }) providers: Provider[] | undefined;
  @Input() isLoading = false;
  @Input() skeletonLimit = 10;
  /** Desplazamiento base: (página - 1) × límite. Lo pasa la página. */
  @Input() rowOffset = 0;

  rowSelected = signal<number>(0);
  deleteConfirmation = signal<boolean>(false);
  providerService = inject(ProviderService);

  changeRowSelectedStatus(id: number) {
    const selectedId = this.providerService.providerIdSelected();

    if (selectedId === id) {
      this.providerService.providerIdSelected.set(0);

      return;
    }

    this.providerService.providerIdSelected.set(id);
  }
}
