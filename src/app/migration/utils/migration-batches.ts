export interface MigrationBatchPlan {
  batches: File[][];
  groups: File[][];
  errors: { filename: string; detail: string }[];
}
const stem = (name: string): string => name.replace(/\.[^.]+$/, '').toLowerCase();
const normalize = (value: unknown): string => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Match complete documents before applying transport limits. */
export async function planMigrationBatches(files: File[], maxDocuments = 10, maxBytes = 2 * 1024 * 1024): Promise<MigrationBatchPlan> {
  const groups: File[][] = files.filter(file => file.name.toLowerCase().endsWith('.json')).map(file => [file]);
  const byStem = new Map<string, File[]>();
  const byCode = new Map<string, File[]>();
  const byControl = new Map<string, File[]>();
  for (const group of groups) {
    byStem.set(stem(group[0].name), group);
    if (group[0].size > 512 * 1024) continue;
    try {
      const raw: unknown = JSON.parse(await group[0].text());
      if (typeof raw !== 'object' || raw === null || !('identificacion' in raw)) continue;
      const identification = raw.identificacion;
      if (typeof identification !== 'object' || identification === null) continue;
      const code = 'codigoGeneracion' in identification ? normalize(identification.codigoGeneracion) : '';
      const control = 'numeroControl' in identification ? normalize(identification.numeroControl) : '';
      if (code) byCode.set(code, group);
      if (control) byControl.set(control, group);
    } catch { /* Malformed JSON is validated by the backend. */ }
  }
  for (const pdf of files.filter(file => file.name.toLowerCase().endsWith('.pdf'))) {
    const key = stem(pdf.name);
    const group = byStem.get(key) ?? byCode.get(normalize(key)) ?? byControl.get(normalize(key));
    if (group && group.length === 1) group.push(pdf);
    else groups.push([pdf]);
  }
  const batches: File[][] = [];
  const errors: MigrationBatchPlan['errors'] = [];
  const acceptedGroups: File[][] = [];
  let batch: File[] = [];
  let bytes = 0;
  let documents = 0;
  for (const group of groups) {
    const oversizedFile = group.find(file => file.size > 512 * 1024);
    const size = group.reduce((total, file) => total + file.size, 0);
    if (oversizedFile || size > maxBytes) {
      errors.push({ filename: group[0].name, detail: oversizedFile ? `El archivo ${oversizedFile.name} supera 512 KB. Optimízalo y vuelve a seleccionar el documento completo.` : 'El documento supera el tamaño permitido por lote.' });
      continue;
    }
    if (documents >= maxDocuments || bytes + size > maxBytes) {
      batches.push(batch); batch = []; bytes = 0; documents = 0;
    }
    acceptedGroups.push(group);
    batch.push(...group); bytes += size; documents++;
  }
  if (batch.length) batches.push(batch);
  return { batches, groups: acceptedGroups, errors };
}
