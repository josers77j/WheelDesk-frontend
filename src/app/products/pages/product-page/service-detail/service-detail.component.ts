import { Component, inject, input, OnInit, signal } from '@angular/core';
import { Product } from '../../../interfaces/product.interface';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  injectMutation,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { Router } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { BrandService } from '../../../../brands/services/brand.service';
import { ProviderService } from '../../../../providers/services/provider.service';
import { AlertService } from '../../../../shared/components/alert/alert.service';
import { FormUtils } from '../../../../shared/utils/form-utils';
import { ValueParams } from '../../../../shared/components/combobox/interfaces/search-param.interface';
import { firstValueFrom } from 'rxjs';
import { Location } from '@angular/common';
import { FormErrorLabelComponent } from '../../../../shared/components/form-error-label/form-error-label.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PRODUCT_TYPE } from '../../../interfaces/product-type.enum';
import { invalidateCatalogCaches } from '../../../../shared/utils/invalidate-catalog-caches.util';

interface productUpdateVars {
  id: number;
  serviceLike: Partial<Product>;
}

interface ServiceForm {
  name: FormControl<string | null>;
  notes: FormControl<string | null>;
  salePrice: FormControl<string | null>;
}

@Component({
  selector: 'app-service-detail-page',
  imports: [ReactiveFormsModule, FormErrorLabelComponent, AlertComponent],
  templateUrl: './service-detail.component.html',
})
export class ServiceDetailComponent implements OnInit {
  constructor(private readonly location: Location) {}
  service = input.required<Product>();
  fb = inject(FormBuilder);
  queryClient = inject(QueryClient);

  router = inject(Router);

  // alert state
  wasSave = signal(false);

  // product data if exists
  productService = inject(ProductService);
  brandService = inject(BrandService);
  providerService = inject(ProviderService);
  alertService = inject(AlertService);

  formUtils = FormUtils;

  tireResource = signal<ValueParams[]>([{ id: 2, name: 'marca' }]);

  // form
  serviceForm: FormGroup<ServiceForm> = this.fb.group({
    name: ['', [Validators.required]],
    notes: ['', []],
    salePrice: ['', []],
  });

  private originalValue: unknown = null;

  hasChanges() {
    return FormUtils.hasChanges(this.serviceForm, this.originalValue);
  }

  // combobox config
  placeholderInput = signal<{ provider: string; brand: string }>({
    provider: 'proveedor',
    brand: 'marca',
  });

  onSubmit(): void {
    if (this.isLoading()) return;
    this.serviceForm.markAllAsTouched();
    const isValid = this.serviceForm.valid;
    const isDirty = this.hasChanges();
    const id = this.service().id;
    if (!isValid) return;
    if (!isDirty) return;

    this.isLoading.set(true);

    const { name, notes, salePrice } = this.serviceForm.value;

    const serviceLike: Partial<Product> = {
      name: name!,
      notes,
      salePrice: salePrice!,
    };

    if (id === 0) {
      this.mutationCreate.mutate(serviceLike);
    } else {
      this.mutationUpdate.mutate({
        id,
        serviceLike,
      });
    }
  }

  mutationCreate = injectMutation(() => ({
    mutationFn: (serviceLike: Partial<Product>) =>
      firstValueFrom(this.productService.createService(serviceLike)),
    onSuccess: (service) => {
      this.queryClient.invalidateQueries({ queryKey: ['services'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Producto creado con éxito');
      this.isLoading.set(false);
      this.router.navigate(['/products/detail', service.id], {
        queryParams: {
          productType: PRODUCT_TYPE.SERVICE,
        },
      });
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  // UPDATE METHOD
  mutationUpdate = injectMutation(() => ({
    mutationFn: ({ id, serviceLike }: productUpdateVars) =>
      firstValueFrom(this.productService.updateService(id, serviceLike)),
    onSuccess: () => {
      this.queryClient.invalidateQueries({ queryKey: ['services'] });
      invalidateCatalogCaches(this.queryClient);
      this.isLoading.set(false);
      this.alertService.showSuccess('Producto actualizado con éxito');
      this.originalValue = this.serviceForm.getRawValue();
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  ngOnInit() {
    this.setFormValue(this.service());
  }

  setFormValue(product: Partial<Product>) {
    if (!product) return;
    this.serviceForm.patchValue({
      name: product.name ?? '',
      notes: product.notes ?? '',
      salePrice: product.salePrice ?? '',
    });
    this.originalValue = this.serviceForm.getRawValue();
  }

  backToPreviusPage() {
    this.location.back();
  }

  isLoading = signal<boolean>(false);
}
