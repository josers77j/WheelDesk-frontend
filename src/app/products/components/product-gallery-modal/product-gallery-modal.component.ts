import { Component, computed, effect, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { injectMutation, injectQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { firstValueFrom } from 'rxjs';
import { ProductService } from '../../services/product.service';
import { AlertService } from '../../../shared/components/alert/alert.service';
import type { PRODUCT_TYPE } from '../../interfaces/product-type.enum';

type GalleryLayout = 'list' | 'grid';
const GALLERY_LAYOUT_KEY = 'workshop.gallery.layout';

function savedGalleryLayout(): GalleryLayout {
  try { return localStorage.getItem(GALLERY_LAYOUT_KEY) === 'grid' ? 'grid' : 'list'; }
  catch { return 'list'; }
}

@Component({
  selector: 'app-product-gallery-modal',
  imports: [],
  templateUrl: './product-gallery-modal.component.html',
})
export class ProductGalleryModalComponent {
  private readonly productService = inject(ProductService);
  private readonly alertService = inject(AlertService);
  private readonly queryClient = inject(QueryClient);

  productId = input<number>(0);
  productType = input<PRODUCT_TYPE | undefined>(undefined);

  galleryOpen = signal(false);
  readonly layout = signal<GalleryLayout>(savedGalleryLayout());
  readonly allSelected = computed(() => this.images().length > 0 && this.images().every(image => this.selectedIds().includes(image.id)));

  setLayout(layout: GalleryLayout): void {
    this.layout.set(layout);
    try { localStorage.setItem(GALLERY_LAYOUT_KEY, layout); } catch { /* Keep the session preference when storage is unavailable. */ }
  }

  toggleSelectAll(): void {
    if (this.busy()) return;
    this.selectedIds.set(this.allSelected() ? [] : this.images().map(image => image.id));
  }

  closeLightboxOutside(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.lightboxUrl.set(null);
  }


  isDragging = signal(false);
  confirmDeleteAll = signal(false);
  lightboxUrl = signal<string | null>(null);
  isUploading = signal(false);
  selectedIds = signal<number[]>([]);
  deleteAction = signal<number | 'selected' | 'all' | null>(null);
  busy = computed(() => this.isUploading() || this.deleteAction() !== null);

  private readonly galleryDialog =
    viewChild<ElementRef<HTMLDialogElement>>('galleryDialog');

  open(): void {
    const dialog = this.galleryDialog()?.nativeElement;
    if (!dialog || dialog.open) return;
    this.galleryOpen.set(true);
    dialog.showModal();
  }

  private readonly lightboxDialog =
    viewChild<ElementRef<HTMLDialogElement>>('lightbox');

  constructor() {
    effect(() => {
      const url = this.lightboxUrl();
      const dialog = this.lightboxDialog()?.nativeElement;
      if (!dialog) return;
      if (url && !dialog.open) dialog.showModal();
      if (!url && dialog.open) dialog.close();
    });
  }

  productQuery = injectQuery(() => ({
    queryKey: ['product', this.productId(), this.productType()],
    queryFn: () =>
      firstValueFrom(
        this.productService.getProductById(this.productId(), this.productType()!),
      ),
    enabled: this.galleryOpen() && this.productId() > 0 && !!this.productType(),
    staleTime: 30_000,
  }));

  images = computed(() => this.productQuery.data()?.images ?? []);

  private refresh(): void {
    this.selectedIds.set([]);
    this.queryClient.invalidateQueries({
      queryKey: ['product', this.productId()],
    });
    this.queryClient.invalidateQueries({ queryKey: ['products'] });
  }

  uploadMutation = injectMutation(() => ({
    mutationFn: (files: File[]) =>
      firstValueFrom(
        this.productService.uploadProductImages(this.productId(), files),
      ),
    onMutate: () => this.isUploading.set(true),
    onSuccess: (result: { uploaded: number; failed: string[] }) => {
      this.isUploading.set(false);
      this.refresh();
      if (result.failed.length > 0) {
        this.alertService.showError(
          `Fallaron: ${result.failed.join(', ')}`,
        );
      } else {
        this.alertService.showSuccess(
          result.uploaded === 1 ? 'Imagen agregada' : `${result.uploaded} imágenes agregadas`,
        );
      }
    },
    onError: (error: { message?: string }) => {
      this.isUploading.set(false);
      this.alertService.showError(error?.message ?? 'Error al subir las imágenes');
    },
  }));

  deleteMutation = injectMutation(() => ({
    onSettled: () => this.deleteAction.set(null),
    mutationFn: (imageIds: number[]) =>
      firstValueFrom(
        this.productService.deleteProductImages(this.productId(), imageIds),
      ),
    onSuccess: () => {
      this.confirmDeleteAll.set(false);
      this.refresh();
      this.alertService.showSuccess('Imágenes eliminadas');
    },
    onError: (error: { message?: string }) => {
      this.alertService.showError(error?.message ?? 'Error al eliminar las imágenes');
    },
  }));

  onFilesSelected(event: Event): void {
    if (this.busy()) return;
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])].filter((f) => f.type.startsWith('image/'));
    input.value = '';
    if (files.length > 0) {
      this.isUploading.set(true);
      this.uploadMutation.mutate(files);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (this.busy()) return;
    this.isDragging.set(false);
    const files = [...(event.dataTransfer?.files ?? [])].filter((f) =>
      f.type.startsWith('image/'),
    );
    if (files.length > 0) {
      this.isUploading.set(true);
      this.uploadMutation.mutate(files);
    }
  }

  toggleSelect(imageId: number): void {
    if (this.busy()) return;
    this.selectedIds.update((ids) =>
      ids.includes(imageId)
        ? ids.filter((id) => id !== imageId)
        : [...ids, imageId],
    );
  }

  deleteSelected(): void {
    if (this.busy()) return;
    const ids = this.selectedIds();
    if (ids.length > 0) {
      this.deleteAction.set('selected');
      this.deleteMutation.mutate(ids);
    }
  }

  deleteOne(imageId: number): void {
    if (this.busy()) return;
    this.deleteAction.set(imageId);
    this.deleteMutation.mutate([imageId]);
  }

  deleteAll(): void {
    if (this.busy()) return;
    if (!this.confirmDeleteAll()) {
      this.confirmDeleteAll.set(true);
      return;
    }
    this.deleteAction.set('all');
    this.deleteMutation.mutate(this.images().map((img) => img.id));
  }

  async downloadImage(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `producto-${this.productId()}-${Date.now()}.webp`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, '_blank');
    }
  }
}
