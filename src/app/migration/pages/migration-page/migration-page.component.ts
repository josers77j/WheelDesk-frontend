import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { TitleComponent } from '../../../shared/components/title/title.component';
import { AlertComponent } from '../../../shared/components/alert/alert.component';
import { AlertService } from '../../../shared/components/alert/alert.service';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { MigrationService } from '../../services/migration.service';
import type {
  MigrationPreviewFile,
  MigrationImportResult,
} from '../../interfaces/migration.interface';

import { planMigrationBatches } from '../../utils/migration-batches';

@Component({
  selector: 'app-migration-page',
  imports: [TitleComponent, AlertComponent, SkeletonComponent],
  templateUrl: './migration-page.component.html',
})
export class MigrationPageComponent implements OnInit, OnDestroy {
  private readonly migrationService = inject(MigrationService);
  private readonly alertService = inject(AlertService);
  private destroyed = false;
  private readonly unlockStorageKey = 'workshop.migration.unlock';
  private readonly unlockTimeoutMs = 15 * 60 * 1000;
  private lockTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTokenRefresh = 0;
  private readonly activityHandler = () => this.onMigrationActivity();

  unlocked = signal(false);
  unlocking = signal(false);
  unlockPassword = signal('');
  unlockError = signal('');

  ngOnInit() {
    window.addEventListener('pointerdown', this.activityHandler);
    window.addEventListener('keydown', this.activityHandler);
    this.restoreUnlock();
  }

  ngOnDestroy() {
    this.destroyed = true;
    ++this.operationVersion;
    window.removeEventListener('pointerdown', this.activityHandler);
    window.removeEventListener('keydown', this.activityHandler);
    if (this.lockTimer) clearTimeout(this.lockTimer);
  }

  private restoreUnlock() {
    const stored = sessionStorage.getItem(this.unlockStorageKey);
    if (!stored) return;

    try {
      const value = JSON.parse(stored) as {
        token: string;
        expiresAt: number;
      };
      if (!value.token || value.expiresAt <= Date.now()) {
        sessionStorage.removeItem(this.unlockStorageKey);
        return;
      }
      this.migrationService.setAccessToken(value.token);
      this.lastTokenRefresh = Date.now();
      this.unlocked.set(true);
      this.armLock();
    } catch {
      sessionStorage.removeItem(this.unlockStorageKey);
    }
  }

  unlock() {
    if (this.unlocking() || !this.unlockPassword()) return;
    this.unlocking.set(true);
    this.unlockError.set('');
    this.migrationService.unlock(this.unlockPassword()).then(
      (result) => {
        this.migrationService.setAccessToken(result.accessToken);
        this.lastTokenRefresh = Date.now();
        sessionStorage.setItem(
          this.unlockStorageKey,
          JSON.stringify({
            token: result.accessToken,
            expiresAt: Date.now() + result.expiresIn * 1000,
          }),
        );
        this.unlocking.set(false);
        this.unlockPassword.set('');
        this.unlocked.set(true);
        this.armLock();
        },
      (error: { error?: { message?: string }; message?: string }) => {
        this.unlocking.set(false);
        this.unlockError.set(
          error?.error?.message ?? error?.message ?? 'No se pudo desbloquear Migración',
        );
      },
    );
  }

  private onMigrationActivity() {
    if (!this.unlocked()) return;
    this.armLock();
    if (Date.now() - this.lastTokenRefresh < 60_000) return;
    this.lastTokenRefresh = Date.now();
    this.migrationService.refreshAccessToken().then(
      (token) => {
        this.migrationService.setAccessToken(token);
        this.updateStoredToken(token);
      },
      () => this.lock(),
    );
  }

  private armLock() {
    if (this.lockTimer) clearTimeout(this.lockTimer);
    this.lockTimer = setTimeout(() => this.lock(), this.unlockTimeoutMs);
  }

  private updateStoredToken(token: string) {
    const stored = sessionStorage.getItem(this.unlockStorageKey);
    if (!stored) return;
    try {
      JSON.parse(stored);
      sessionStorage.setItem(
        this.unlockStorageKey,
        JSON.stringify({
          token,
          expiresAt: Date.now() + 15 * 60 * 1000,
        }),
      );
    } catch {
      sessionStorage.removeItem(this.unlockStorageKey);
    }
  }

  lock() {
    if (this.importing() || this.previewing()) { this.armLock(); return; }
    if (this.lockTimer) clearTimeout(this.lockTimer);
    this.lockTimer = null;
    this.migrationService.setAccessToken(null);
    sessionStorage.removeItem(this.unlockStorageKey);
    this.unlocked.set(false);
    this.unlockPassword.set('');
    this.unlockError.set('');
    this.verifyResult.set(null);
    this.importing.set(false);
    this.newImport();
  }

  previewing = signal(false);
  files = signal<MigrationPreviewFile[]>([]);
  isDragging = signal(false);

  private lastFiles: File[] = [];
  importing = signal(false);
  verifying = signal(false);
  verifyResult = signal<{
    total: number;
    complete: number;
    missing: {
      generationCode: string;
      controlNumber: string;
      customerName: string;
      missingPdf: boolean;
      missingJson: boolean;
    }[];
  } | null>(null);
  /** Banner persistente de errores (se quita a mano, no es toast). */
  importErrors = signal<{ filename: string; detail: string }[]>([]);
  errorsDismissed = signal(false);
  importSummary = signal<MigrationImportResult['summary'] | null>(null);
  completedBatches = signal(0);
  totalBatches = signal(0);
  importInterrupted = signal(false);
  private pendingBatches: File[][] = [];
  private documentGroups: File[][] = [];
  private operationVersion = 0;
  selectedFiles = signal<string[]>([]);

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const selected = [...(input.files ?? [])].filter((f) =>
      f.name.toLowerCase().endsWith('.json') ||
      f.name.toLowerCase().endsWith('.pdf'),
    );
    input.value = '';
    if (selected.length > 0) this.sendPreview(selected);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    if (this.importing() || this.previewing()) return;
    this.isDragging.set(false);
    const dropped = [...(event.dataTransfer?.files ?? [])].filter((f) =>
      f.name.toLowerCase().endsWith('.json') ||
      f.name.toLowerCase().endsWith('.pdf'),
    );
    if (dropped.length > 0) this.sendPreview(dropped);
  }

  private async sendPreview(selected: File[]): Promise<void> {
    if (this.importing() || this.previewing()) return;
    const version = ++this.operationVersion;
    this.previewing.set(true);
    this.importSummary.set(null);
    this.importInterrupted.set(false);
    this.selectedFiles.set([]);
    this.files.set([]);
    try {
      const plan = await planMigrationBatches(selected);
      if (this.destroyed || version !== this.operationVersion) return;
      this.pendingBatches = plan.batches;
      this.documentGroups = plan.groups;
      if (plan.errors.length) this.importSummary.set({ migrated: 0, skipped: 0, failed: plan.errors.length });
      this.lastFiles = plan.batches.flat();
      this.importErrors.set(plan.errors);
      this.errorsDismissed.set(false);
      this.completedBatches.set(0);
      this.totalBatches.set(plan.batches.length);
      for (const batch of plan.batches) {
        const result = await this.migrationService.preview(batch);
        if (this.destroyed || version !== this.operationVersion) return;
        this.files.update(files => [...files, ...result.files]);
      }
    } catch {
      if (this.destroyed || version !== this.operationVersion) return;
      this.pendingBatches = [];
      this.lastFiles = [];
      this.files.set([]);
      this.alertService.showError('No se completó la revisión. Selecciona los archivos nuevamente.');
    } finally {
      if (!this.destroyed && version === this.operationVersion) this.previewing.set(false);
    }
  }

  toggleSelect(filename: string) {
    this.selectedFiles.update((names) =>
      names.includes(filename)
        ? names.filter((n) => n !== filename)
        : [...names, filename],
    );
  }

  toggleSelectAll() {
    const all = this.files().map((f) => f.filename);
    this.selectedFiles.set(
      this.selectedFiles().length === all.length ? [] : all,
    );
  }

  removeSelected() {
    const remove = new Set(this.selectedFiles());
    if (remove.size === 0) return;
    const remaining = this.documentGroups.filter(group => !group.some(file => remove.has(file.name))).flat();
    this.selectedFiles.set([]);
    if (remaining.length === 0) {
      this.newImport();
      return;
    }
    this.sendPreview(remaining);
  }

  newImport(): void {
    ++this.operationVersion;
    this.pendingBatches = [];
    this.documentGroups = [];
    this.completedBatches.set(0);
    this.totalBatches.set(0);
    this.importInterrupted.set(false);
    this.lastFiles = [];
    this.files.set([]);
    this.selectedFiles.set([]);
    this.previewing.set(false);
    this.isDragging.set(false);
    this.importErrors.set([]);
    this.errorsDismissed.set(false);
    this.importSummary.set(null);
  }

  get createCount() {
    return (f: MigrationPreviewFile) =>
      f.items.filter((i) => i.match === 'create').length;
  }

  get readyCount() {
    return this.files().filter(
      (f) => f.errors.length === 0 && !f.duplicate,
    ).length;
  }

  /** PDFs en la selección actual (se pueden adjuntar aunque no haya JSONs). */
  get pdfCount() {
    return this.lastFiles.filter((f) =>
      f.name.toLowerCase().endsWith('.pdf'),
    ).length;
  }

  async startImport(): Promise<void> {
    if (this.importing() || this.previewing() || this.pendingBatches.length === 0) return;
    const version = this.operationVersion;
    this.importing.set(true);
    this.importInterrupted.set(false);
    this.errorsDismissed.set(false);
    while (this.pendingBatches.length) {
      try {
        const result = await this.migrationService.import(this.pendingBatches[0]);
        if (this.destroyed || version !== this.operationVersion) return;
        const previous = this.importSummary() ?? { migrated: 0, skipped: 0, failed: 0 };
        this.importSummary.set({ migrated: previous.migrated + result.summary.migrated, skipped: previous.skipped + result.summary.skipped, failed: previous.failed + result.summary.failed });
        this.importErrors.update(errors => [...errors, ...result.errors, ...result.orphans.map(filename => ({ filename, detail: 'PDF sin factura importada: sube su JSON.' }))]);
        if (result.attached.length) this.alertService.showSuccess(`PDFs adjuntos a facturas ya importadas: ${result.attached.length}`);
        this.pendingBatches.shift();
        this.completedBatches.update(count => count + 1);
        this.lastFiles = this.pendingBatches.flat();
      } catch {
        if (this.destroyed || version !== this.operationVersion) return;
        this.importInterrupted.set(true);
        this.importing.set(false);
        this.alertService.showError('Se perdió la confirmación de un lote. Su resultado es desconocido; conserva los archivos pendientes y reintenta para comprobarlos sin duplicar ventas.');
        return;
      }
    }
    this.importing.set(false);
    this.documentGroups = [];
    this.files.set([]);
    this.selectedFiles.set([]);
    const summary = this.importSummary();
    if (summary) this.alertService.showSuccess(`Importación finalizada: ${summary.migrated} importadas, ${summary.skipped} omitidas, ${summary.failed} fallidas`);
  }

  verifyFiles() {
    if (this.verifying()) return;
    this.verifying.set(true);
    this.migrationService.verifyFiles().then(
      (result) => {
        this.verifying.set(false);
        this.verifyResult.set(result);
        if (result.missing.length === 0) {
          this.alertService.showSuccess(
            `${result.complete}/${result.total} facturas con PDF y JSON.`,
          );
        } else {
          this.alertService.showError(
            `${result.missing.length} facturas con archivos faltantes.`,
          );
        }
      },
      (error: { message?: string }) => {
        this.verifying.set(false);
        this.alertService.showError(
          error?.message ?? 'No se pudieron verificar los archivos',
        );
      },
    );
  }

}
