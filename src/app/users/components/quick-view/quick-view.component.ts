import { Component, inject, input, signal } from '@angular/core';

import { DatePipe } from '@angular/common';
import { User } from '../../interfaces/user.interface';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-quick-view',
  imports: [DatePipe],
  templateUrl: './quick-view.component.html',
})
export class QuickViewComponent {
  private readonly authService = inject(AuthService);

  user = input<User>()

  isCopy = signal<boolean>(false)

  copyText(text: string) {
    this.isCopy.set(true)
    navigator.clipboard.writeText(text);
    setTimeout(() => {
      this.isCopy.set(false)
    }, 2000);
  }

  isCurrentSession(tokenId: string): boolean {
    return tokenId === this.authService.user()?.sessionId;
  }
}
