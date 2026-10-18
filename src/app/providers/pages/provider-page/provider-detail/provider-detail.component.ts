import { createProviderForm, resetProviderForm, providerPayload } from '../../../utils/provider-form.util';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { Provider } from '../../../interfaces/provider.interface';
import { ReactiveFormsModule } from '@angular/forms';
import {
  injectMutation,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { Router } from '@angular/router';
import { ProviderService } from '../../../services/provider.service';
import { AlertService } from '../../../../shared/components/alert/alert.service';
import { firstValueFrom } from 'rxjs';
import { Location } from '@angular/common';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { FormErrorLabelComponent } from '../../../../shared/components/form-error-label/form-error-label.component';
import { invalidateCatalogCaches } from '../../../../shared/utils/invalidate-catalog-caches.util';
import { FormUtils } from '../../../../shared/utils/form-utils';

interface providerUpdateVars {
  id: number;
  providerLike: Partial<Provider>;
}
@Component({
  selector: 'app-provider-detail',
  imports: [ReactiveFormsModule, FormErrorLabelComponent, AlertComponent],
  templateUrl: './provider-detail.component.html',
})
export class ProviderDetailComponent implements OnInit {
  constructor(private readonly location: Location) {}

  provider = input.required<Provider>();
  queryClient = inject(QueryClient);
  router = inject(Router);

  wasSave = signal(false);
  ProviderService = inject(ProviderService);
  alertService = inject(AlertService);

  providerForm = createProviderForm();

  private originalValue: unknown = null;

  hasChanges() {
    return FormUtils.hasChanges(this.providerForm, this.originalValue);
  }

  onSubmit(): void {
    if (this.isLoading()) return;
    this.providerForm.markAllAsTouched();
    const isValid = this.providerForm.valid;
    const isDirty = this.hasChanges();
    if (!isValid) return;
    if (!isDirty) return;

    this.isLoading.set(true);

    const id = this.provider().id;
    const providerLike = providerPayload(this.providerForm);

    if (id === 0) {
      this.mutationCreate.mutate(providerLike);
    } else {
      this.mutationUpdate.mutate({
        id,
        providerLike,
      });
    }
  }

  // CREATE METHOD
  mutationCreate = injectMutation(() => ({
    mutationFn: (providerLike: Partial<Provider>) =>
      firstValueFrom(this.ProviderService.createProvider(providerLike)),
    onSuccess: (provider) => {
      this.queryClient.invalidateQueries({ queryKey: ['providers'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Proveedor creado con éxito');
      this.isLoading.set(false);
      this.router.navigate(['/providers/detail', provider.id]);
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  // UPDATE METHOD
  mutationUpdate = injectMutation(() => ({
    mutationFn: ({ id, providerLike }: providerUpdateVars) =>
      firstValueFrom(this.ProviderService.updateProvider(id, providerLike)),
    onSuccess: () => {
      this.queryClient.invalidateQueries({ queryKey: ['providers'] });
      invalidateCatalogCaches(this.queryClient);
      this.isLoading.set(false);
      this.alertService.showSuccess('Proveedor actualizado con éxito');
      this.originalValue = this.providerForm.getRawValue();
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  // Set values on update
  ngOnInit() {
    this.setFormValue(this.provider());
  }

  setFormValue(formLike: Partial<Provider>) {
    resetProviderForm(this.providerForm, formLike);
    this.originalValue = this.providerForm.getRawValue();
  }

  backToPreviusPage() {
    this.location.back();
  }

  isLoading = signal<boolean>(false);
}
