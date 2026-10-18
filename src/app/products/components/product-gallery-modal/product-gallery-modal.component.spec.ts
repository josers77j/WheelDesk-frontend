import { TestBed } from '@angular/core/testing';
import { provideTanStackQuery, QueryClient } from '@tanstack/angular-query-experimental';
import { of, Subject } from 'rxjs';
import { ProductGalleryModalComponent } from './product-gallery-modal.component';
import { emptyProduct, ProductService } from '../../services/product.service';
import { PRODUCT_TYPE } from '../../interfaces/product-type.enum';
import { AlertService } from '../../../shared/components/alert/alert.service';

describe('Product gallery loading', (): void => {
  const images = [{ id: 1, key: 'one', url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', order: 0 }];
  let service: jasmine.SpyObj<ProductService>;
  let client: QueryClient;

  beforeEach((): void => {
    localStorage.removeItem('workshop.gallery.layout');
    service = jasmine.createSpyObj<ProductService>('ProductService', ['getProductById', 'uploadProductImages', 'deleteProductImages']);
    service.getProductById.and.returnValue(of({ ...emptyProduct, id: 1, images }));
    service.uploadProductImages.and.returnValue(of({ uploaded: 1, failed: [] }));
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    TestBed.configureTestingModule({ imports: [ProductGalleryModalComponent], providers: [
      provideTanStackQuery(client),
      { provide: ProductService, useValue: service },
      { provide: AlertService, useValue: jasmine.createSpyObj('AlertService', ['showSuccess', 'showError']) },
    ] });
  });

  afterEach((): void => { client.clear(); localStorage.removeItem('workshop.gallery.layout'); });

  it('fetches and renders associated images when opened', async (): Promise<void> => {
    const fixture = TestBed.createComponent(ProductGalleryModalComponent);
    fixture.componentRef.setInput('productId', 1);
    fixture.componentRef.setInput('productType', PRODUCT_TYPE.TIRE);
    fixture.detectChanges();
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    fixture.componentInstance.open();
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();
    expect(service.getProductById).toHaveBeenCalledWith(1, PRODUCT_TYPE.TIRE);
    expect(fixture.nativeElement.querySelector('img')).not.toBeNull();
    dialog.close();
  });

  it('reloads images after an upload without closing the gallery', async (): Promise<void> => {
    const fixture = TestBed.createComponent(ProductGalleryModalComponent);
    fixture.componentRef.setInput('productId', 1);
    fixture.componentRef.setInput('productType', PRODUCT_TYPE.SUPPLY);
    service.getProductById.and.returnValue(of({ ...emptyProduct, id: 1, images: [] }));
    fixture.detectChanges();
    fixture.componentInstance.open();
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    service.getProductById.and.returnValue(of({ ...emptyProduct, id: 1, images }));
    fixture.componentInstance.uploadMutation.mutate([new File(['image'], 'photo.png', { type: 'image/png' })]);
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();
    expect(service.getProductById.calls.count()).toBe(2);
    expect(fixture.nativeElement.querySelector('img')).not.toBeNull();
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    dialog.close();
  });

  it('loads the next product without displaying the previous images', async (): Promise<void> => {
    const fixture = TestBed.createComponent(ProductGalleryModalComponent);
    fixture.componentRef.setInput('productId', 1);
    fixture.componentRef.setInput('productType', PRODUCT_TYPE.TIRE);
    fixture.detectChanges();
    fixture.componentInstance.open();
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    const closed = new Promise<void>((resolve) => {
      dialog.addEventListener('close', (): void => resolve(), { once: true });
    });
    dialog.close();
    await closed;
    fixture.detectChanges();
    expect(fixture.componentInstance.galleryOpen()).toBeFalse();
    fixture.componentRef.setInput('productId', 2);
    service.getProductById.and.returnValue(of({ ...emptyProduct, id: 2, images: [] }));
    fixture.detectChanges();
    fixture.componentInstance.open();
    fixture.detectChanges();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();
    expect(service.getProductById).toHaveBeenCalledWith(2, PRODUCT_TYPE.TIRE);
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    dialog.close();
  });

  it('blocks repeated and conflicting actions until an upload ends', async (): Promise<void> => {
    const pending = new Subject<{ uploaded: number; failed: string[] }>();
    service.uploadProductImages.and.returnValue(pending);
    const fixture = TestBed.createComponent(ProductGalleryModalComponent);
    fixture.componentRef.setInput('productId', 1);
    fixture.componentRef.setInput('productType', PRODUCT_TYPE.TIRE);
    fixture.detectChanges();
    const transfer = new DataTransfer();
    transfer.items.add(new File(['image'], 'test.webp', { type: 'image/webp' }));
    const drop = new DragEvent('drop', { dataTransfer: transfer });
    fixture.componentInstance.onDrop(drop);
    fixture.componentInstance.onDrop(drop);
    fixture.componentInstance.deleteOne(1);
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(service.uploadProductImages).toHaveBeenCalledTimes(1);
    expect(service.deleteProductImages).not.toHaveBeenCalled();
    pending.error(new Error('test failure'));
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(fixture.componentInstance.busy()).toBeFalse();
  });

  it('defaults to list and persists grid without fetching a closed product', (): void => {
    const first = TestBed.createComponent(ProductGalleryModalComponent);
    first.detectChanges();
    expect(first.componentInstance.layout()).toBe('list');
    expect(first.nativeElement.querySelector('[aria-label="Vista de lista"]').classList.contains('btn-primary')).toBeTrue();
    first.componentInstance.setLayout('grid'); first.detectChanges();
    expect(first.nativeElement.querySelector('[aria-label="Vista de cuadrícula"]').classList.contains('btn-primary')).toBeTrue();
    expect(localStorage.getItem('workshop.gallery.layout')).toBe('grid');
    const second = TestBed.createComponent(ProductGalleryModalComponent);
    second.detectChanges();
    expect(second.componentInstance.layout()).toBe('grid');
    expect(service.getProductById).not.toHaveBeenCalled();
  });

  it('selects all images, clears them and locks selection while uploading', async (): Promise<void> => {
    const fixture = TestBed.createComponent(ProductGalleryModalComponent);
    fixture.componentRef.setInput('productId', 1);
    fixture.componentRef.setInput('productType', PRODUCT_TYPE.TIRE);
    fixture.detectChanges(); fixture.componentInstance.open(); fixture.detectChanges();
    await new Promise<void>(resolve => setTimeout(resolve, 50)); fixture.detectChanges();
    const gallery = fixture.componentInstance;
    gallery.toggleSelectAll(); expect(gallery.selectedIds()).toEqual([1]); expect(gallery.allSelected()).toBeTrue();
    gallery.toggleSelectAll(); expect(gallery.selectedIds()).toEqual([]);
    gallery.isUploading.set(true); gallery.toggleSelectAll(); gallery.toggleSelect(1);
    expect(gallery.selectedIds()).toEqual([]);
    gallery.isUploading.set(false);
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog'); dialog.close();
  });

  it('opens the image in a second modal and closes it through the backdrop', async (): Promise<void> => {
    const fixture = TestBed.createComponent(ProductGalleryModalComponent);
    fixture.componentRef.setInput('productId', 1);
    fixture.componentRef.setInput('productType', PRODUCT_TYPE.TIRE);
    fixture.detectChanges(); fixture.componentInstance.open(); fixture.detectChanges();
    await new Promise<void>(resolve => setTimeout(resolve, 50)); fixture.detectChanges();
    const openButton: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Abrir imagen del producto"]');
    openButton.click(); fixture.detectChanges();
    const dialogs: NodeListOf<HTMLDialogElement> = fixture.nativeElement.querySelectorAll('dialog');
    expect(dialogs[1].open).toBeTrue();
    const image = dialogs[1].querySelector('img');
    if (!image) throw new Error('Lightbox image missing');
    image.click(); fixture.detectChanges(); expect(fixture.componentInstance.lightboxUrl()).not.toBeNull();
    const backdrop = dialogs[1].querySelector<HTMLButtonElement>('.modal-backdrop button');
    if (!backdrop) throw new Error('Lightbox backdrop missing');
    backdrop.click(); fixture.detectChanges(); expect(fixture.componentInstance.lightboxUrl()).toBeNull();
    expect(dialogs[0].open).toBeTrue(); dialogs[0].close();
  });

});
