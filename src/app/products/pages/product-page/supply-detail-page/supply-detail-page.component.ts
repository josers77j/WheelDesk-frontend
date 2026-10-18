import { Component, inject, input, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  QueryClient,
  injectMutation,
  injectQuery,
} from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { BrandService } from '../../../../brands/services/brand.service';
import { ProviderService } from '../../../../providers/services/provider.service';
import { AlertService } from '../../../../shared/components/alert/alert.service';
import { ValueParams } from '../../../../shared/components/combobox/interfaces/search-param.interface';
import { FormUtils } from '../../../../shared/utils/form-utils';
import { PRODUCT_TYPE } from '../../../interfaces/product-type.enum';
import { Product } from '../../../interfaces/product.interface';
import { ProductService } from '../../../services/product.service';
import { Location } from '@angular/common';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { FormErrorLabelComponent } from '../../../../shared/components/form-error-label/form-error-label.component';

import { ComboboxFormControlComponent } from '../../../../shared/components/combobox-form-control/combobox-form-control.component';
import { invalidateCatalogCaches } from '../../../../shared/utils/invalidate-catalog-caches.util';

interface productUpdateVars {
  id: number;
  supplyLike: Partial<Product>;
}

interface SupplyForm {
  name: FormControl<string | null>;
  notes: FormControl<string | null>;
  salePrice: FormControl<string | null>;
  purchasePrice: FormControl<string | null>;
  brandId: FormControl<number | null>;
  providerId: FormControl<number | null>;
}

@Component({
  selector: 'app-supply-detail-page',
  imports: [
    AlertComponent,
    FormErrorLabelComponent,
    ComboboxFormControlComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './supply-detail-page.component.html',
})
export class SupplyDetailPageComponent implements OnInit {
  constructor(private readonly location: Location) {}
  supply = input.required<Product>();
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

  // form
  supplyForm: FormGroup<SupplyForm> = this.fb.group({
    name: ['', [Validators.required]],
    notes: ['', []],
    salePrice: ['', [Validators.required]],
    purchasePrice: ['', [Validators.required]],
    brandId: [0, [Validators.required, this.formUtils.noSelected]],
    providerId: [0, []],
  });

  private originalValue: unknown = null;

  hasChanges() {
    return FormUtils.hasChanges(this.supplyForm, this.originalValue);
  }

  // Brand Section
  selectedBrand = signal<ValueParams | null>(null);

  setBrand(brand: ValueParams | null) {
    this.supplyForm.get('brandId')?.setValue(brand?.id ?? null);
    this.supplyForm.get('brandId')?.markAsDirty();
    this.selectedBrand.set(brand);
  }

  brandCombobox = signal<string>('');
  brandComboboxOutput = signal<string>('');
  /** Perezoso: pide al interactuar con su combobox. */
  brandTouched = signal(false);

  brandsQuery = injectQuery(() => ({
    queryKey: ['brand-combobox', this.brandComboboxOutput()],

    queryFn: () =>
      firstValueFrom(
        this.brandService.getBrandByName(
          this.limit,
          this.brandComboboxOutput(),
        ),
      ),
    staleTime: 5000 * 60,
    enabled: this.brandTouched(),
  }));

  limit = 5;

  // Provider Section
  selectedProvider = signal<ValueParams | null>(null);

  setProvider(provider: ValueParams | null) {
    this.supplyForm.get('providerId')?.setValue(provider?.id ?? null);
    this.supplyForm.get('providerId')?.markAsDirty();
    this.selectedProvider.set(provider);
  }
  providerComboboxOutput = signal<string>('');
  /** Perezoso: pide al interactuar con su combobox. */
  providerTouched = signal(false);

  providersQuery = injectQuery(() => ({
    queryKey: ['provider-combobox', this.providerComboboxOutput()],

    queryFn: () =>
      firstValueFrom(
        this.providerService.getProviderByName(
          this.limit,
          this.providerComboboxOutput(),
        ),
      ),
    staleTime: 5000 * 60,
    enabled: this.providerTouched(),
  }));

  // combobox config
  placeholderInput = signal<{ provider: string; brand: string }>({
    provider: 'proveedor',
    brand: 'marca',
  });

  onSubmit(): void {
    if (this.isLoading()) return;
    this.supplyForm.markAllAsTouched();
    const isValid = this.supplyForm.valid;
    const isDirty = this.hasChanges();
    const id = this.supply().id;
    if (!isValid) return;
    if (!isDirty) return;

    this.isLoading.set(true);

    const { name, notes, salePrice, purchasePrice, brandId, providerId } =
      this.supplyForm.value;

    const supplyLike: Partial<Product> = {
      name: name!,
      notes,
      salePrice: salePrice!,
      purchasePrice: purchasePrice!,
      brandId,
      providerId: providerId ?? null,
    };

    if (id === 0) {
      this.mutationCreate.mutate(supplyLike);
    } else {
      this.mutationUpdate.mutate({
        id,
        supplyLike,
      });
    }
  }

  mutationCreate = injectMutation(() => ({
    mutationFn: (supplyLike: Partial<Product>) =>
      firstValueFrom(this.productService.createSupply(supplyLike)),
    onSuccess: (supply) => {
      this.queryClient.invalidateQueries({ queryKey: ['supplies'] });
      invalidateCatalogCaches(this.queryClient);
      this.alertService.showSuccess('Producto creado con éxito');
      this.isLoading.set(false);
      this.router.navigate(['/products/detail', supply.id], {
        queryParams: {
          productType: PRODUCT_TYPE.SUPPLY,
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
    mutationFn: ({ id, supplyLike }: productUpdateVars) =>
      firstValueFrom(this.productService.updateSupply(id, supplyLike)),
    onSuccess: () => {
      this.queryClient.invalidateQueries({ queryKey: ['supplies'] });
      invalidateCatalogCaches(this.queryClient);
      this.isLoading.set(false);
      this.alertService.showSuccess('Producto actualizado con éxito');
      this.originalValue = this.supplyForm.getRawValue();
    },
    onError: (exception) => {
      this.isLoading.set(false);
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  ngOnInit() {
    this.setFormValue(this.supply());
  }

  setFormValue(product: Partial<Product>) {
    if (!product) return;
    this.supplyForm.patchValue({
      name: product.name ?? '',
      notes: product.notes ?? '',
      salePrice: product.salePrice ?? '',
      purchasePrice: product.purchasePrice ?? '',
      brandId: product.brandId ?? null,
      providerId: product.providerId ?? null,
    });

    this.selectedBrand.set(product.brand ? { id: product.brand.id, name: product.brand.name } : null);
    this.selectedProvider.set(product.provider ? { id: product.provider.id, name: product.provider.name } : null);
    this.originalValue = this.supplyForm.getRawValue();
  }

  backToPreviusPage() {
    this.location.back();
  }

  isLoading = signal<boolean>(false);
}
