import {
  Component,
  computed,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  injectMutation,
  QueryClient,
} from '@tanstack/angular-query-experimental';

import { User, USER_ROLES } from '../../interfaces/user.interface';
import { UserService } from '../../services/user.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { FormErrorLabelComponent } from '../../../shared/components/form-error-label/form-error-label.component';
import { RoleLabelPipe } from '../../../shared/pipes/role-label.pipe';
import { FormUtils } from '../../../shared/utils/form-utils';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-user-form-modal',
  imports: [ReactiveFormsModule, FormErrorLabelComponent, RoleLabelPipe],
  templateUrl: './user-form-modal.component.html',
})
export class UserFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly alertService = inject(AlertService);
  private readonly queryClient = inject(QueryClient);
  private readonly authService = inject(AuthService);

  private readonly formModal =
    viewChild<ElementRef<HTMLDialogElement>>('formModal');

  saved = output<User>();

  userId = signal<number>(0);
  isEditing = computed(() => this.userId() > 0);
  isSubmitting = signal<boolean>(false);
  readonly roles = USER_ROLES;

  userForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.pattern(FormUtils.emailPattern)]],
    role: this.fb.control<User['role']>('VIEWER', [Validators.required, Validators.pattern(/^(ADMIN|SELLER|VIEWER|ACCOUNTANT)$/)]),
  });

  mutationCreate = injectMutation(() => ({
    mutationFn: (userLike: Partial<User>) =>
      firstValueFrom(this.userService.createUser(userLike)),
    onSuccess: (user) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['users'] });
      this.alertService.showSuccess('Usuario creado con éxito');
      this.saved.emit(user);
      this.closeModal();
    },
    onError: (error): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(error?.message || 'Error al crear el usuario');
    },
  }));

  mutationUpdate = injectMutation(() => ({
    mutationFn: ({ id, userLike }: { id: number; userLike: Partial<User> }) =>
      firstValueFrom(this.userService.updateUser(id, userLike)),
    onSuccess: (user, { id }: { id: number; userLike: Partial<User> }) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['users'] });
      // If the logged-in user edited their own profile, invalidate the auth
      // TTL cache so the next checkProfile() re-fetches their fresh data.
      if (this.authService.user()?.id === id) {
        this.authService.invalidateProfileCache();
      }
      this.alertService.showSuccess('Usuario actualizado con éxito');
      this.saved.emit(user);
      this.closeModal();
    },
    onError: (error): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(
        error?.message || 'Error al actualizar el usuario',
      );
    },
  }));

  openForCreate() {
    this.userId.set(0);
    this.userForm.reset({ name: '', email: '', role: 'VIEWER' });
    this.isSubmitting.set(false);
    this.formModal()?.nativeElement?.showModal();
  }

  openForEdit(user: User) {
    this.userId.set(user.id);
    this.userForm.reset({
      name: user.name,
      email: user.email,
      role: user.role ?? 'VIEWER',
    });
    this.isSubmitting.set(false);
    this.formModal()?.nativeElement?.showModal();
  }

  closeModal() {
    this.formModal()?.nativeElement?.close();
    this.userForm.reset();
    this.userId.set(0);
    this.isSubmitting.set(false);
  }

  onSubmit(): void {
    if (this.isSubmitting()) return;
    this.userForm.markAllAsTouched();
    if (this.userForm.invalid) return;

    if (!this.userForm.dirty) {
      this.closeModal();
      return;
    }

    this.isSubmitting.set(true);

    const userLike: Partial<User> = {
      name: this.userForm.value.name?.trim() || '',
      email: this.userForm.value.email?.trim() || '',
      role: this.userForm.value.role ?? 'VIEWER',
    };

    if (this.isEditing()) {
      this.mutationUpdate.mutate({
        id: this.userId(),
        userLike,
      });
    } else {
      this.mutationCreate.mutate(userLike);
    }
  }
}
