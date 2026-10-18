import { Pipe, PipeTransform } from '@angular/core';
import type { UserRole } from '../../users/interfaces/user.interface';

/** Rol del usuario en español (en código se guarda el enum en inglés). */
@Pipe({
  name: 'RoleLabel',
})
export class RoleLabelPipe implements PipeTransform {
  transform(value: UserRole | string | null | undefined): string {
    switch (value) {
      case 'ADMIN':
        return 'Administrador';
      case 'SELLER':
        return 'Vendedor';
      case 'ACCOUNTANT':
        return 'Contador';
      case 'VIEWER':
        return 'Visualizador';
      default:
        return value ?? '—';
    }
  }
}
