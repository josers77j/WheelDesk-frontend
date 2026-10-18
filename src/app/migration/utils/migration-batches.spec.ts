import { planMigrationBatches } from './migration-batches';

describe('Migration batch boundaries', (): void => {
  const json = (name: string, code = ''): File => new File([JSON.stringify({ identificacion: { codigoGeneracion: code } })], name);
  it('keeps a content-matched pair together and permits an odd file count', async (): Promise<void> => {
    const files = [json('legacy.json', 'ABC-123'), new File(['pdf'], 'abc123.PDF'), json('alone.json')];
    const result = await planMigrationBatches(files, 1);
    expect(result.batches.map(batch => batch.map(file => file.name))).toEqual([['legacy.json', 'abc123.PDF'], ['alone.json']]);
  });
  it('keeps malformed JSON paired by filename for backend validation', async (): Promise<void> => {
    const result = await planMigrationBatches([new File(['invalid'], 'A.json'), new File(['pdf'], 'a.pdf')]);
    expect(result.batches[0].length).toBe(2);
  });
  it('excludes the entire group when its PDF exceeds 512 KiB and continues', async (): Promise<void> => {
    const result = await planMigrationBatches([json('large.json'), new File([new Uint8Array(512 * 1024 + 1)], 'large.pdf'), json('good.json')]);
    expect(result.errors.length).toBe(1);
    expect(result.batches.flat().map(file => file.name)).toEqual(['good.json']);
  });
  it('never splits a pair to fit the byte limit', async (): Promise<void> => {
    const first = [json('a.json'), new File(['123456'], 'a.pdf')];
    const second = [json('b.json'), new File(['123456'], 'b.pdf')];
    const maxBytes = first.reduce((total, file) => total + file.size, 0);
    const result = await planMigrationBatches([...first, ...second], 10, maxBytes);
    expect(result.batches.map(batch => batch.length)).toEqual([2, 2]);
  });
  it('prefers the matching stem over a generation code and preserves orphan PDFs', async (): Promise<void> => {
    const result = await planMigrationBatches([json('named.json'), json('other.json', 'named'), new File(['pdf'], 'NAMED.pdf'), new File(['orphan'], 'missing.pdf')]);
    expect(result.groups.map(group => group.map(file => file.name))).toEqual([['named.json', 'NAMED.pdf'], ['other.json'], ['missing.pdf']]);
  });
  it('excludes oversized JSON and its matching PDF before preview', async (): Promise<void> => {
    const result = await planMigrationBatches([new File([new Uint8Array(512 * 1024 + 1)], 'large.json'), new File(['pdf'], 'large.pdf'), json('good.json')]);
    expect(result.errors.length).toBe(1);
    expect(result.batches.flat().map(file => file.name)).toEqual(['good.json']);
  });
  it('accepts a JSON exactly at 512 KiB', async (): Promise<void> => {
    const result = await planMigrationBatches([new File(['{}'.padEnd(512 * 1024, ' ')], 'limit.json')]);
    expect(result.errors.length).toBe(0);
    expect(result.batches.length).toBe(1);
  });
});
