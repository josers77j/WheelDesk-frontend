import { createProviderForm, resetProviderForm, providerPayload } from '../../utils/provider-form.util';
import {
  Component,
  computed,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  injectMutation,
  QueryClient,
} from '@tanstack/angular-query-experimental';

import { Provider } from '../../interfaces/provider.interface';
import { ProviderService } from '../../services/provider.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { FormErrorLabelComponent } from '../../../shared/components/form-error-label/form-error-label.component';
import { invalidateCatalogCaches } from '../../../shared/utils/invalidate-catalog-caches.util';

@Component({
  selector: 'app-provider-form-modal',
  imports: [ReactiveFormsModule, FormErrorLabelComponent],
  templateUrl: './provider-form-modal.component.html',
})
export class ProviderFormModalComponent {
  private readonly providerService = inject(ProviderService);
  private readonly alertService = inject(AlertService);
  private readonly queryClient = inject(QueryClient);

  private readonly formModal =
    viewChild<ElementRef<HTMLDialogElement>>('formModal');

  saved = output<Provider>();

  providerId = signal<number>(0);
  isEditing = computed(() => this.providerId() > 0);
  isSubmitting = signal<boolean>(false);

  providerForm = createProviderForm();

  mutationCreate = injectMutation(() => ({
    mutationFn: (providerLike: Partial<Provider>) =>
      firstValueFrom(this.providerService.createProvider(providerLike)),
    onSuccess: (provider) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['providers'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Proveedor creado con éxito');
      this.saved.emit(provider);
      this.closeModal();
    },
    onError: (error): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(error?.message || 'Error al crear el proveedor');
    },
  }));

  mutationUpdate = injectMutation(() => ({
    mutationFn: ({ id, providerLike }: { id: number; providerLike: Partial<Provider> }) =>
      firstValueFrom(this.providerService.updateProvider(id, providerLike)),
    onSuccess: (provider) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['providers'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Proveedor actualizado con éxito');
      this.saved.emit(provider);
      this.closeModal();
    },
    onError: (error): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(
        error?.message || 'Error al actualizar el proveedor',
      );
    },
  }));

  openForCreate() {
    this.providerId.set(0);
    resetProviderForm(this.providerForm);
    this.isSubmitting.set(false);
    this.formModal()?.nativeElement?.showModal();
  }

  openForEdit(provider: Provider) {
    this.providerId.set(provider.id);
    resetProviderForm(this.providerForm, provider);
    this.isSubmitting.set(false);
    this.formModal()?.nativeElement?.showModal();
  }

  closeModal() {
    this.formModal()?.nativeElement?.close();
    this.providerForm.reset();
    this.providerId.set(0);
    this.isSubmitting.set(false);
  }

  onSubmit(): void {
    if (this.isSubmitting()) return;
    this.providerForm.markAllAsTouched();
    if (this.providerForm.invalid) return;

    if (!this.providerForm.dirty) {
      this.closeModal();
      return;
    }

    this.isSubmitting.set(true);

    const providerLike = providerPayload(this.providerForm);

    if (this.isEditing()) {
      this.mutationUpdate.mutate({
        id: this.providerId(),
        providerLike,
      });
    } else {
      this.mutationCreate.mutate(providerLike);
    }
  }
}
