import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  injectMutation,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';

import { AlertService } from '../../../shared/components/alert/alert.service';
import { RefreshToken, UserResponse } from '../../interfaces/user.interface';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-revoke-sessions-modal',
  imports: [DatePipe],
  templateUrl: './revoke-sessions-modal.component.html',
})
export class RevokeSessionsModalComponent {
  private readonly userService = inject(UserService);
  private readonly queryClient = inject(QueryClient);
  private readonly alertService = inject(AlertService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  user = input.required<{ name: string; refreshToken: RefreshToken[] }>();

  /** IDs de tokens que se están revocando actualmente (loading state) */
  revokingTokens = signal<Set<string>>(new Set());

  /** Tokens mostrados — se inicializa del input y se filtra localmente al revocar */
  tokens = signal<RefreshToken[]>([]);

  /**
   * Puerta de confirmación inline (patrón warehouse-form-modal): el primer
   * clic arma la revocación, el segundo la ejecuta; cancelar no revoca nada.
   */
  pendingRevokeId = signal<string | null>(null);

  hasSessions = computed(() => this.tokens().length > 0);

  /** Inicializar tokens cuando cambia el input (usuario seleccionado) */
  private initTokens = effect(() => {
    const userInput = this.user();
    if (userInput) {
      this.tokens.set(userInput.refreshToken);
      this.pendingRevokeId.set(null);
    }
  });

  revokeSession = injectMutation(() => ({
    mutationFn: (tokenId: string) =>
      firstValueFrom(this.userService.revokeSession(tokenId)),
    onMutate: (tokenId: string) => {
      this.revokingTokens.update((set) => new Set(set).add(tokenId));
    },
    onSuccess: (_, tokenId) => {
      this.revokingTokens.update((set) => {
        const next = new Set(set);
        next.delete(tokenId);
        return next;
      });
      // Filtrar el token revocado del listado local (sin recargar)
      this.tokens.update((current) =>
        current.filter((t) => t.id !== tokenId),
      );
      // Actualizar el conteo de sesiones en la tabla principal.
      // Ojo: la llave real lleva filtros (['users', limit, page, query]),
      // así que se parchean todas las que empiecen con 'users'.
      const userId = this.user().refreshToken[0]?.userId;
      this.queryClient.setQueriesData<UserResponse>({ queryKey: ['users'] }, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((u) =>
            u.id === userId
              ? { ...u, refreshToken: u.refreshToken.filter((t) => t.id !== tokenId) }
              : u,
          ),
        };
      });
      this.alertService.showSuccess('Sesión revocada con éxito');
      if (tokenId === this.authService.user()?.sessionId) {
        this.authService.endSession();
        void this.router.navigate(['/auth/login']);
      }
    },
    onError: (exception, tokenId) => {
      this.revokingTokens.update((set) => {
        const next = new Set(set);
        next.delete(tokenId);
        return next;
      });
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  onRevoke(tokenId: string) {
    if (this.pendingRevokeId() !== tokenId) {
      this.pendingRevokeId.set(tokenId);
      return;
    }
    this.pendingRevokeId.set(null);
    this.revokeSession.mutate(tokenId);
  }

  cancelRevoke() {
    this.pendingRevokeId.set(null);
  }

  isCurrentSession(token: RefreshToken): boolean {
    return token.id === this.authService.user()?.sessionId;
  }
}
