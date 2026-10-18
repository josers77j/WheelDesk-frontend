import {
  Component,
  ElementRef,
  inject,
  output,
  signal,
  computed,
  ViewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  injectMutation,
  QueryClient,
} from '@tanstack/angular-query-experimental';

import { Brand } from '../../interfaces/brand.interface';
import { BrandService } from '../../services/brand.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { FormErrorLabelComponent } from '../../../shared/components/form-error-label/form-error-label.component';
import { invalidateCatalogCaches } from '../../../shared/utils/invalidate-catalog-caches.util';

@Component({
  selector: 'app-brand-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, FormErrorLabelComponent],
  templateUrl: './brand-form-modal.component.html',
})
export class BrandFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly brandService = inject(BrandService);
  private readonly alertService = inject(AlertService);
  private readonly queryClient = inject(QueryClient);

  @ViewChild('formModal') formModal!: ElementRef<HTMLDialogElement>;

  saved = output<Brand>();

  brandId = signal<number>(0);
  isEditing = computed(() => this.brandId() > 0);
  isSubmitting = signal<boolean>(false);

  brandForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
  });

  mutationCreate = injectMutation(() => ({
    mutationFn: (brandLike: Partial<Brand>) =>
      firstValueFrom(this.brandService.createBrand(brandLike)),
    onSuccess: (brand) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['brands'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Marca creada con éxito');
      this.saved.emit(brand);
      this.closeModal();
    },
    onError: (error): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(error?.message || 'Error al crear la marca');
    },
  }));

  mutationUpdate = injectMutation(() => ({
    mutationFn: ({ id, brandLike }: { id: number; brandLike: Partial<Brand> }) =>
      firstValueFrom(this.brandService.updateBrand(id, brandLike)),
    onSuccess: (brand) => {
      this.isSubmitting.set(false);
      this.queryClient.invalidateQueries({ queryKey: ['brands'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Marca actualizada con éxito');
      this.saved.emit(brand);
      this.closeModal();
    },
    onError: (error): void => {
      this.isSubmitting.set(false);
      this.alertService.showError(
        error?.message || 'Error al actualizar la marca',
      );
    },
  }));

  openForCreate() {
    this.brandId.set(0);
    this.brandForm.reset({ name: '', description: '' });
    this.isSubmitting.set(false);
    this.formModal?.nativeElement?.showModal();
  }

  openForEdit(brand: Brand) {
    this.brandId.set(brand.id);
    this.brandForm.reset({
      name: brand.name,
      description: brand.description || '',
    });
    this.isSubmitting.set(false);
    this.formModal?.nativeElement?.showModal();
  }

  closeModal() {
    this.formModal?.nativeElement?.close();
    this.brandForm.reset();
    this.brandId.set(0);
    this.isSubmitting.set(false);
  }

  onSubmit(): void {
    if (this.isSubmitting()) return;
    this.brandForm.markAllAsTouched();
    if (this.brandForm.invalid) return;

    if (!this.brandForm.dirty) {
      this.closeModal();
      return;
    }

    this.isSubmitting.set(true);

    const brandLike: Partial<Brand> = {
      name: this.brandForm.value.name?.trim() || '',
      description: this.brandForm.value.description?.trim() || '',
    };

    if (this.isEditing()) {
      this.mutationUpdate.mutate({
        id: this.brandId(),
        brandLike,
      });
    } else {
      this.mutationCreate.mutate(brandLike);
    }
  }
}
