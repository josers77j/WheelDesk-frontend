import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { FormUtils } from '../../../shared/utils/form-utils';
import { AlertService } from '../../../shared/components/alert/alert.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  fb = inject(FormBuilder);
  hasErrors = signal(false);
  router = inject(Router);
  isPosting = signal<boolean>(false);
  authService = inject(AuthService);
  alertService = inject(AlertService);
  errorMessage = signal<string | null>(this.authService.loginErrorMessage());

  validator = FormUtils;

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  onSubmit(): Partial<{ email: string | null; password: string | null }> | void {
    if (this.isPosting()) return;
    if (!this.loginForm.valid) return;

    this.isPosting.set(true);

    const { email = '', password = '' } = this.loginForm.value;
    this.authService.login(email!, password!).subscribe((isAuthenticated) => {
      if (isAuthenticated) {
        this.alertService.showSuccess(
          '¡Bienvenido! Sesión iniciada con éxito.',
        );
        this.isPosting.set(false);
        this.router.navigateByUrl(this.authService.user()?.role === 'ACCOUNTANT' ? '/accounting-reports' : '/');
        return;
      }
      this.errorMessage.set(
        this.authService.loginErrorMessage() ??
          'No se pudo iniciar sesión. Intenta nuevamente.',
      );
      this.hasErrors.set(true);
      setTimeout(() => {
        this.hasErrors.set(false);
      }, 2000);
      this.isPosting.set(false);
    });

    return this.loginForm.value;
  }
}
