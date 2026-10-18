import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Brand } from '../../../interfaces/brand.interface';
import { FormErrorLabelComponent } from '../../../../shared/components/form-error-label/form-error-label.component';
import { Router } from '@angular/router';

import { BrandService } from '../../../services/brand.service';
import { AlertService } from '../../../../shared/components/alert/alert.service';

import {
  injectMutation,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { Location } from '@angular/common';
import { invalidateCatalogCaches } from '../../../../shared/utils/invalidate-catalog-caches.util';
import { FormUtils } from '../../../../shared/utils/form-utils';

interface brandUpdateVars {
  id: number;
  brandLike: Partial<Brand>;
}
@Component({
  selector: 'app-brand-detail',
  imports: [ReactiveFormsModule, FormErrorLabelComponent, AlertComponent],
  templateUrl: './brand-detail.component.html',
})
export class BrandDetailComponent implements OnInit {
  constructor(private readonly location: Location) {}

  brand = input.required<Brand>();
  fb = inject(FormBuilder);
  queryClient = inject(QueryClient);
  router = inject(Router);

  //alert signal
  wasSave = signal(false);

  brandService = inject(BrandService);
  alertService = inject(AlertService);

  isLoading = signal<boolean>(false);

  brandForm = this.fb.group({
    name: ['', [Validators.required]],
    description: ['', []],
  });

  private originalValue: unknown = null;

  hasChanges() {
    return FormUtils.hasChanges(this.brandForm, this.originalValue);
  }

  onSubmit(): void {
    if (this.isLoading()) return;
    this.brandForm.markAllAsTouched();
    const isValid = this.brandForm.valid;
    const isDirty = this.hasChanges();
    if (!isValid) return;
    if (!isDirty) return;

    this.isLoading.set(true);

    const id = this.brand().id;
    const brandLike: Partial<Brand> = {
      description: this.brandForm.value.description!,
      name: this.brandForm.value.name!,
    };

    if (id === 0) {
      this.mutationCreate.mutate(brandLike);
    } else {
      this.mutationUpdate.mutate({
        id,
        brandLike,
      });
    }
  }

  // CREATE METHOD
  mutationCreate = injectMutation(() => ({
    mutationFn: (brandLike: Partial<Brand>) =>
      firstValueFrom(this.brandService.createBrand(brandLike)),
    onSuccess: (brand) => {
      this.queryClient.invalidateQueries({ queryKey: ['brands'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Marca creada con éxito');
      this.isLoading.set(false);
      this.router.navigate(['/brands/detail', brand.id]);
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  // UPDATE METHOD
  mutationUpdate = injectMutation(() => ({
    mutationFn: ({ id, brandLike }: brandUpdateVars) =>
      firstValueFrom(this.brandService.updateBrand(id, brandLike)),
    onSuccess: () => {
      this.queryClient.invalidateQueries({ queryKey: ['brands'] });
      invalidateCatalogCaches(this.queryClient);
      this.isLoading.set(false);
      this.alertService.showSuccess('Marca actualizada con éxito');
      this.originalValue = this.brandForm.getRawValue();
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  // Set values on update
  ngOnInit() {
    this.setFormValue(this.brand());
  }

  setFormValue(formLike: Partial<Brand>) {
    this.brandForm.reset(formLike);
    this.originalValue = this.brandForm.getRawValue();
  }

  backToPreviusPage() {
    this.location.back();
  }
}
