import { Component, inject, input, OnInit, signal } from '@angular/core';
import { User } from '../../../interfaces/user.interface';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  injectMutation,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { Router } from '@angular/router';
import { UserService } from '../../../services/user.service';
import { AlertService } from '../../../../shared/components/alert/alert.service';
import { firstValueFrom } from 'rxjs';
import { Location } from '@angular/common';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { FormErrorLabelComponent } from '../../../../shared/components/form-error-label/form-error-label.component';
import { FormUtils } from '../../../../shared/utils/form-utils';
import { AuthService } from '../../../../auth/services/auth.service';

interface userUpdateVars {
  id: number;
  userLike: Partial<User>;
}
@Component({
  selector: 'app-user-detail',
  imports: [ReactiveFormsModule, FormErrorLabelComponent, AlertComponent],
  templateUrl: './user-detail.component.html',
})
export class UserDetailComponent implements OnInit {
  constructor(private readonly location: Location) {}

  user = input.required<User>();
  fb = inject(FormBuilder);
  queryClient = inject(QueryClient);
  router = inject(Router);

  wasSave = signal(false);
  userService = inject(UserService);
  alertService = inject(AlertService);
  authService = inject(AuthService);

  userForm = this.fb.group({
    name: ['', [Validators.required]],
    email: [
      '',
      [Validators.required, Validators.pattern(FormUtils.emailPattern)],
    ],
  });

  private originalValue: unknown = null;

  hasChanges() {
    return FormUtils.hasChanges(this.userForm, this.originalValue);
  }

  onSubmit(): void {
    if (this.isLoading()) return;
    this.userForm.markAllAsTouched();
    const isValid = this.userForm.valid;
    const isDirty = this.hasChanges();
    if (!isValid) return;
    if (!isDirty) return;

    this.isLoading.set(true);

    const id = this.user().id;
    const userLike: Partial<User> = {
      email: this.userForm.value.email!,
      name: this.userForm.value.name!,
    };

    if (id === 0) {
      this.mutationCreate.mutate(userLike);
    } else {
      this.mutationUpdate.mutate({
        id,
        userLike,
      });
    }
  }

  // CREATE METHOD
  mutationCreate = injectMutation(() => ({
    mutationFn: (userLike: Partial<User>) =>
      firstValueFrom(this.userService.createUser(userLike)),
    onSuccess: (user) => {
      this.queryClient.invalidateQueries({ queryKey: ['users'] });
      this.alertService.showSuccess('Usuario creado con éxito');
      this.isLoading.set(false);
      this.router.navigate(['/users/detail', user.id]);
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  // UPDATE METHOD
  mutationUpdate = injectMutation(() => ({
    mutationFn: ({ id, userLike }: userUpdateVars) =>
      firstValueFrom(this.userService.updateUser(id, userLike)),
    onSuccess: (_user, { id }) => {
      this.queryClient.invalidateQueries({ queryKey: ['users'] });
      // If the logged-in user edited their own profile, invalidate the auth
      // TTL cache so the next checkProfile() re-fetches their fresh data.
      if (this.authService.user()?.id === id) {
        this.authService.invalidateProfileCache();
      }
      this.isLoading.set(false);
      this.alertService.showSuccess('Usuario actualizado con éxito');
      this.originalValue = this.userForm.getRawValue();
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  // Set values on update
  ngOnInit() {
    this.setFormValue(this.user());
  }

  setFormValue(formLike: Partial<User>) {
    this.userForm.reset(formLike);
    this.originalValue = this.userForm.getRawValue();
  }

  backToPreviusPage() {
    this.location.back();
  }

  isLoading = signal<boolean>(false);
}
