import { CustomerMissingInfoComponent } from '../customer-missing-info/customer-missing-info.component';
import { CustomerService } from '../../services/customer.service';
import { Component, inject, input, signal } from '@angular/core';
import { Customer } from '../../interfaces/customer.interface';
import { TaxPayerPipe } from '../../pipes/tax-payer.pipe';
import { CustomerTypePipe } from '../../pipes/customer-type-pipe';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { customerMissingFields } from '../../utils/customer-missing-fields.util';

@Component({
  selector: 'app-customer-table',
  imports: [CustomerMissingInfoComponent, TaxPayerPipe, CustomerTypePipe, SkeletonComponent],
  templateUrl: './customer-table.component.html',
})
export class CustomerTableComponent {
  customers = input<Customer[]>();
  isLoading = input<boolean>(false);
  skeletonLimit = input<number>(10);
  /** Desplazamiento base: (página - 1) × límite. Lo pasa la página. */
  rowOffset = input<number>(0);

  rowSelected = signal<number>(0);
  deleteConfirmation = signal<boolean>(false);
  CustomerService = inject(CustomerService);

  /**
   * Campos faltantes del cliente migrado (vacío = completo, sin icono).
   * La regla vive en el util compartido: el checkout de ventas muestra el
   * mismo warning en su fila resumen.
   */
  readonly missingFields = customerMissingFields;

  changeRowSelectedStatus(id: number) {
    const selectedId = this.CustomerService.customerIdSelected();

    if (selectedId === id) {
      this.CustomerService.customerIdSelected.set(0);

      return;
    }

    this.CustomerService.customerIdSelected.set(id);
  }
}
