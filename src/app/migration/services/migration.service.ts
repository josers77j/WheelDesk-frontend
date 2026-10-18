import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  MigrationImportResult,
  MigrationPreviewFile,
} from '../interfaces/migration.interface';

const baseUrl = `${environment.baseUrl}/migration`;

@Injectable({ providedIn: 'root' })
export class MigrationService {
  private readonly http = inject(HttpClient);
  private readonly accessToken = signal<string | null>(null);

  setAccessToken(token: string | null) {
    this.accessToken.set(token);
  }

  unlock(password: string) {
    return firstValueFrom(
      this.http.post<{ accessToken: string; expiresIn: number }>(
        `${baseUrl}/unlock`,
        { password },
      ),
    );
  }

  refreshAccessToken() {
    return firstValueFrom(
      this.http.post<string>(`${baseUrl}/unlock/refresh`, {}, this.authOptions()),
    );
  }

  preview(files: File[]) {
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    return firstValueFrom(
      this.http.post<{ files: MigrationPreviewFile[] }>(
        `${baseUrl}/invoices/preview`,
        formData,
        this.authOptions(),
      ),
    );
  }

  import(files: File[]): Promise<MigrationImportResult> {
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    return firstValueFrom(
      this.http.post<MigrationImportResult>(`${baseUrl}/invoices/import`, formData, this.authOptions()),
    );
  }

  verifyFiles() {
    return firstValueFrom(
      this.http.get<{
        total: number;
        complete: number;
        missing: {
          generationCode: string;
          controlNumber: string;
          customerName: string;
          missingPdf: boolean;
          missingJson: boolean;
        }[];
      }>(`${baseUrl}/invoices/verify`, this.authOptions()),
    );
  }

  private authOptions() {
    const token = this.accessToken();
    return token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : {};
  }
}
