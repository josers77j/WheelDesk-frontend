import { Component, inject, Input, signal } from '@angular/core';

import { DatePipe } from '@angular/common';
import { User } from '../../interfaces/user.interface';
import { UserService } from '../../services/user.service';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { RoleLabelPipe } from '../../../shared/pipes/role-label.pipe';

@Component({
  selector: 'app-user-table',
  imports: [DatePipe, SkeletonComponent, RoleLabelPipe],
  templateUrl: './user-table.component.html',
})
export class UserTableComponent {
  @Input({ required: true }) users: User[] | undefined;
  @Input() isLoading = false;
  @Input() skeletonLimit = 10;
  /** Desplazamiento base: (página - 1) × límite. Lo pasa la página. */
  @Input() rowOffset = 0;

  rowSelected = signal<number>(0);
  deleteConfirmation = signal<boolean>(false);
  userService = inject(UserService);

  changeRowSelectedStatus(id: number) {
    const selectedId = this.userService.userIdSelected();

    if (selectedId === id) {
      this.userService.userIdSelected.set(0);

      return;
    }
    this.userService.userIdSelected.set(id);
  }
}
