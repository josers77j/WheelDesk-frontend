import { FilterPanelComponent } from '../../../../shared/components/filter-panel/filter-panel.component';
import { listSelectionNumber } from '../../../../shared/utils/list-selection';
import { Component, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';
import { DeleteActionModalComponent } from '../../../../shared/components/delete-action-modal/delete-action-modal.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { LimitComponent } from '../../../../shared/components/limit/limit.component';

import { TitleComponent } from '../../../../shared/components/title/title.component';
import { ErrorBannerComponent } from '../../../../shared/components/error-banner/error-banner.component';
import { TireTableComponent } from '../../../components/tire-table/tire-table.component';
import { ProductService } from '../../../services/product.service';

import { ActivatedRoute, Router } from '@angular/router';
import {
  injectMutation,
  injectQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import { PaginationService } from '../../../../shared/components/pagination/pagination.service';
import { DeleteActionModalService } from '../../../../shared/components/delete-action-modal/deleteActionModal.service';
import { AlertService } from '../../../../shared/components/alert/alert.service';
import { firstValueFrom, map } from 'rxjs';
import { PRODUCT_CATEGORY } from '../../../consts/product-category.const';
import { BrandService } from '../../../../brands/services/brand.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { sameSearchParams } from '../../../../shared/utils/search-params-compare.util';
import { ComboboxComponent } from '../../../../shared/components/combobox/combobox.component';
import { SearchParams } from '../../../interfaces/search-param.interface';
import { quantityStatusList } from '../../../interfaces/quantity-status.enum';
import { ValueParams } from '../../../../shared/components/combobox/interfaces/search-param.interface';
import { ProviderService } from '../../../../providers/services/provider.service';
import { SearchMeasureComponent } from '../../../../shared/components/search-measure/search-measure.component';
import { PRODUCT_TYPE } from '../../../interfaces/product-type.enum';
import { Product } from '../../../interfaces/product.interface';
import {
  loadFilterValue,
  saveFilterValue,
} from '../../../../shared/utils/filter-storage.util';
import { QuickViewComponent } from '../../../components/quick-view/quick-view.component';
import { ProductGalleryModalComponent } from '../../../components/product-gallery-modal/product-gallery-modal.component';
import { TireFormModalComponent } from '../../../components/tire-form-modal/tire-form-modal.component';
import { invalidateCatalogCaches } from '../../../../shared/utils/invalidate-catalog-caches.util';

@Component({
  selector: 'app-tire-tab',
  imports: [
    FilterPanelComponent,
    TireTableComponent,
    PaginationComponent,
    DeleteActionModalComponent,
    AlertComponent,
    TireFormModalComponent,
    LimitComponent,
    TitleComponent,
    ErrorBannerComponent,
    ComboboxComponent,
    SearchMeasureComponent,
    QuickViewComponent,
    ProductGalleryModalComponent,
  ],
  templateUrl: './tire-tab.component.html',
})
export class TireTabComponent {
  // Angular injects
  route = inject(Router);
  activatedRoute = inject(ActivatedRoute);
  queryClient = inject(QueryClient);

  readonly productType = PRODUCT_TYPE;

  // custom injects
  productService = inject(ProductService);
  brandsService = inject(BrandService);
  providersService = inject(ProviderService);
  paginationService = inject(PaginationService);
  deleteModalService = inject(DeleteActionModalService);
  alertService = inject(AlertService);

  // Paginator variables
  limitPerPage = signal<number>(10);
  limitList = signal<number[]>([10, 20, 50, 100]);
  eskeletonElements = computed(() => new Array(this.limitPerPage()).fill(0));

  selectedBrand = signal<ValueParams | null>(null);
  selectedProvider = signal<ValueParams | null>(null);

  isOpen = signal<boolean>(false);
  openToggle() {
    this.isOpen.update((value) => !value);
  }

  // Url params
  urlSearchParams = computed<SearchParams>(() => {
    const map = this.queryParamsSignal();

    return {
      width: this.sanitizedNumber(map.get('width')),
      aspectRatio: this.sanitizedNumber(map.get('aspectRatio')),
      rimDiameter: this.sanitizedNumber(map.get('rimDiameter')),
      brandId: this.sanitizedNumber(map.get('brandId')),
      providerId: this.sanitizedNumber(map.get('providerId')),
      quantityStatus: map.get('quantityStatus'),
    };
  });

  queryParamsSignal = toSignal(this.activatedRoute.queryParamMap, {
    initialValue: this.activatedRoute.snapshot.queryParamMap,
  });

  // Search params
  formSearchParams = signal<SearchParams>({
    width: null,
    aspectRatio: null,
    rimDiameter: null,
    brandId: null,
    providerId: null,
    quantityStatus: null,
  });

  sincronyzedUrlSearchParams = effect(() => {
    const params = this.urlSearchParams();

    this.formSearchParams.set(params);
    this.appliedSearchParams.set(params);
  });

  /** Busca marca en la data ya cargada del listado (evita fetch en selección). */
  private findBrandInList(brandId: number): ValueParams | null {
    const brand = this.tireQuery.data()?.data?.find(
      (t) => t.brand?.id === brandId,
    )?.brand;
    return brand ? { id: brand.id, name: brand.name } : null;
  }

  /** Busca proveedor en la data ya cargada del listado. */
  private findProviderInList(providerId: number): ValueParams | null {
    const provider = this.tireQuery.data()?.data?.find(
      (t) => t.provider?.id === providerId,
    )?.provider;
    return provider ? { id: provider.id, name: provider.name } : null;
  }

  assignBrand = effect(() => {
    const brandId = this.formSearchParams().brandId;

    if (!brandId) {
      this.selectedBrand.set(null);
      return;
    }
    // Ya seleccionada: no hacer nada.
    if (this.selectedBrand()?.id === brandId) return;
    // 1) En data del listado (evita fetch al seleccionar fila).
    const inList = this.findBrandInList(brandId);
    if (inList) {
      this.selectedBrand.set(inList);
      return;
    }
    // 2) sessionStorage (deep-link sin data en lista).
    const saved = loadFilterValue('filter-brand');
    if (saved && saved.id === brandId) {
      this.selectedBrand.set(saved);
      return;
    }
    // 3) Fallback: fetch real (deep-link sin data en lista ni caché).
    firstValueFrom(
      this.brandsService
        .getBrandById(brandId)
        .pipe(map((brand) => this.selectedBrand.set(brand))),
    );
  });

  assignProvider = effect(() => {
    const providerId = this.formSearchParams().providerId;

    if (!providerId) {
      this.selectedProvider.set(null);
      return;
    }
    if (this.selectedProvider()?.id === providerId) return;
    const inList = this.findProviderInList(providerId);
    if (inList) {
      this.selectedProvider.set(inList);
      return;
    }
    const saved = loadFilterValue('filter-provider');
    if (saved && saved.id === providerId) {
      this.selectedProvider.set(saved);
      return;
    }

    firstValueFrom(
      this.providersService
        .getProviderById(providerId)
        .pipe(map((provider) => this.selectedProvider.set(provider))),
    );
  });

  // Brand param config
  setBrand(brand: ValueParams | null) {
    this.formSearchParams.update((params) => ({
      ...params,
      brandId: brand?.id,
    }));
    // El elegido ya trae {id, name}: sin fetch adicional.
    this.selectedBrand.set(brand);
    saveFilterValue(
      'filter-brand',
      brand ? { id: brand.id, name: brand.name } : null,
    );
  }

  setQuantityStatus(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.formSearchParams.update((params) => ({
      ...params,
      quantityStatus: value === '' ? null : value,
    }));
  }

  quantityStatusList = quantityStatusList;

  brandCombobox = signal<string>('');
  brandComboboxOutput = signal<string>('');
  /** Perezoso: marcas solo al interactuar con su combobox. */
  brandTouched = signal(false);

  brandsQuery = injectQuery(() => ({
    queryKey: ['brand-combobox', this.brandComboboxOutput()],

    queryFn: () =>
      firstValueFrom(
        this.brandsService.getBrandByName(
          this.limit,
          this.brandComboboxOutput(),
        ),
      ),
    staleTime: 5000 * 60,
    // Filtros: piden al interactuar (clic o tecla), no al montar.
    enabled: this.brandTouched(),
  }));

  // Provider param config
  setProvider(provider: ValueParams | null) {
    this.formSearchParams.update((params) => ({
      ...params,
      providerId: provider?.id,
    }));
    // El elegido ya trae {id, name}: sin fetch adicional.
    this.selectedProvider.set(provider);
    saveFilterValue(
      'filter-provider',
      provider ? { id: provider.id, name: provider.name } : null,
    );
  }

  providerCombobox = signal<string>('');
  providerComboboxOutput = signal<string>('');
  /** Perezoso: proveedores solo al interactuar con su combobox. */
  providerTouched = signal(false);

  limit = 5;

  providersQuery = injectQuery(() => ({
    queryKey: ['provider-combobox', this.providerComboboxOutput()],

    queryFn: () =>
      firstValueFrom(
        this.providersService.getProviderByName(
          this.limit,
          this.providerComboboxOutput(),
        ),
      ),
    staleTime: 5000 * 60,
    // Filtros: piden al interactuar (clic o tecla), no al montar.
    enabled: this.providerTouched(),
  }));

  // Set dimensions to search param
  setWidth(width: string | null) {
    this.formSearchParams.update((params) => ({
      ...params,
      width: this.sanitizedNumber(width),
    }));
  }
  setAspectRatio(aspectRatio: string | null) {
    this.formSearchParams.update((params) => ({
      ...params,
      aspectRatio: this.sanitizedNumber(aspectRatio),
    }));
  }

  setRimDiameter(rimDiameter: string | null) {
    this.formSearchParams.update((params) => ({
      ...params,
      rimDiameter: this.sanitizedNumber(rimDiameter),
    }));
  }

  appliedSearchParams = signal<SearchParams>(this.formSearchParams());

  /**
   * Auto-busca 1000ms después de dejar de escribir en las medidas. Solo
   * dispara si difieren de lo aplicado y el nonce cancela el pendiente si
   * se acciona Buscar manualmente.
   */
  private searchNonce = signal(0);

  measureDebounceEffect = effect((onCleanup) => {
    this.searchNonce();
    if (
      sameSearchParams(this.formSearchParams(), this.appliedSearchParams(), [
        'width',
        'aspectRatio',
        'rimDiameter',
        'brandId',
        'providerId',
        'quantityStatus',
      ])
    )
      return;
    const timeout = setTimeout(() => this.onSearch(), 1000);
    onCleanup(() => clearTimeout(timeout));
  });

  /** Un solo limpiador para las 3 medidas (ancho/perfil/rin). */
  clearMeasures() {
    this.formSearchParams.update((params) => ({
      ...params,
      width: null,
      aspectRatio: null,
      rimDiameter: null,
    }));
  }

  onResetFilters(): void {
    if (this.tireQuery.isFetching()) return;
    this.formSearchParams.set({
      width: null,
      aspectRatio: null,
      rimDiameter: null,
      brandId: null,
      providerId: null,
      quantityStatus: null,
    });
    this.selectedBrand.set(null);
    this.selectedProvider.set(null);
    this.brandComboboxOutput.set('');
    this.providerComboboxOutput.set('');
    this.onSearch();
  }

  // Search param variables
  onSearch(): void {
    if (this.tireQuery.isFetching()) return;
    const params = this.formSearchParams();
    this.searchNonce.update((n) => n + 1);
    this.setSearchParamInUrl(params);
    this.appliedSearchParams.set(params);
  }

  // Change limit
  onNewLimit(newLimit: number) {
    this.limitPerPage.set(newLimit);
    this.setSearchParamInUrl(this.formSearchParams());
  }

  // Get Tires using tanstack
  tireQuery = injectQuery(() => ({
    queryKey: [
      'tires',
      this.limitPerPage(),
      this.paginationService.currentPage(),
      this.appliedSearchParams(),
    ],

    queryFn: () =>
      firstValueFrom(
        this.productService.getProducts(
          PRODUCT_CATEGORY.TIRES,
          this.paginationService.currentPage(),
          this.limitPerPage(),
          this.appliedSearchParams(),
        ),
      ),
    staleTime: 5000 * 60,
  }));

  // Title
  titleData = computed(() => ({
    name: 'Llantas',
    count: this.tireQuery.data()?.meta.total,
  }));
  placeholderInput = signal<{ provider: string; brand: string }>({
    provider: 'proveedor',
    brand: 'marca',
  });

  setSearchParamInUrl(searchParams?: SearchParams) {
    this.route.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        page: 1,
        width: this.sanitizedNumber(searchParams?.width),
        aspectRatio: this.sanitizedNumber(searchParams?.aspectRatio),
        rimDiameter: this.sanitizedNumber(searchParams?.rimDiameter),
        brandId: this.sanitizedNumber(searchParams?.brandId),
        providerId: this.sanitizedNumber(searchParams?.providerId),
        quantityStatus: searchParams?.quantityStatus ?? null,
      },
      queryParamsHandling: 'merge',
    });
  }

  // Delete action
  deleteBrandEffect = effect(() => {
    if (this.deleteModalService.state() === 'confirming') {
      this.onDeleteConfirmed();
    }
  });

  onDeleteConfirmed() {
    this.deleteModalService.state.set('loading');
    const id = this.productService.productIdSelected();
    this.mutationDelete.mutate(id);
  }

  mutationDelete = injectMutation(() => ({
    mutationFn: (id: number) =>
      firstValueFrom(this.productService.deleteProduct(id)),
    onSuccess: () => {
      this.deleteModalService.state.set('finished');
      this.queryClient.invalidateQueries({ queryKey: ['tires'] });
      invalidateCatalogCaches(this.queryClient);
      this.productService.productIdSelected.set(0);
      this.alertService.showSuccess('Producto eliminado con éxito');
    },
    onError: (exception) => {
      this.deleteModalService.state.set('finished');
      this.alertService.showError(`Error: ${exception.message}`);
    },
  }));

  routeToRedirect = signal('/products/detail');
  idSelected = computed(() => this.productService.productIdSelected());

  @ViewChild('tireFormModal') tireFormModal!: TireFormModalComponent;

  openCreateModal() {
    this.tireFormModal?.openForCreate();
  }

  async openEditModal() {
    const product = await this.fetchFullProduct();
    if (product) this.tireFormModal?.openForEdit(product);
  }

  /** Detalle bajo demanda: solo al abrir Ver/Editar (seleccionar no pide). */
  previewProduct = signal<Product | null>(null);
  loadingDetail = signal(false);

  private fetchFullProduct(): Promise<Product | null> {
    const id = this.productService.productIdSelected();
    if (!id || this.loadingDetail()) return Promise.resolve(null);
    this.loadingDetail.set(true);
    return firstValueFrom(
      this.productService.getProductById(id, PRODUCT_TYPE.TIRE),
    )
      .then((product) => {
        return product;
      })
      .catch((error: { message?: string }) => {
        this.alertService.showError(error?.message ?? 'Error al cargar el producto');
        return null;
      })
      .finally(() => this.loadingDetail.set(false));
  }

  async openPreview() {
    const product = await this.fetchFullProduct();
    if (!product) return;
    this.previewProduct.set(product);
    (
      document.getElementById('my_modal_3') as HTMLDialogElement | null
    )?.showModal();
  }

  onProductSaved() {
    this.deselectProduct();
  }

  deselectProduct() {
    this.productService.productIdSelected.set(0);
    this.previewProduct.set(null);
  }

  sanitizedNumber(value?: string | number | null) {
    if (value === null || value === undefined || value === '') return null;

    const sanitizedValue = Number(value); // or +value
    return Number.isFinite(sanitizedValue) ? sanitizedValue : null;
  }
  readonly selectedRowNumber = listSelectionNumber(
    this.productService.productIdSelected, this.paginationService.currentPage, () => this.tireQuery.data(),
  );
}
