import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { normalizeTextInterceptor, normalizeUserText } from './normalize-text.interceptor';

describe('Conservative user text normalization', (): void => {
 beforeEach((): void => { TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([normalizeTextInterceptor])), provideHttpClientTesting()] }); });
 afterEach((): void => TestBed.inject(HttpTestingController).verify());
 it('keeps accents, case and internal multiline notes', (): void => {
  expect(normalizeUserText('  José\r\nSegunda línea\u0000  ')).toBe('José\nSegunda línea');
 });
 it('cleans API filter text and repeated parameters', (): void => {
  TestBed.inject(HttpClient).get(`${environment.baseUrl}/quotations`, {params: { documentNumber: '  COT-1  ', filter: ['  uno ', ' dos  '] }}).subscribe();
  const request = TestBed.inject(HttpTestingController).expectOne(req => req.url.endsWith('/quotations'));
  expect(request.request.params.get('documentNumber')).toBe('COT-1');
  expect(request.request.params.getAll('filter')).toEqual(['uno', 'dos']); request.flush({});
 });
 it('normalizes nested form text while preserving secrets, files and original JSON', (): void => {
  const body = {name: ' José ', password: ' password ', token: ' token ', notes: '  A\nB  ', details: [{description: '  Llanta  '}], payload: {name: ' Original '}};
  TestBed.inject(HttpClient).post(`${environment.baseUrl}/quotations`, body).subscribe();
  const request = TestBed.inject(HttpTestingController).expectOne(`${environment.baseUrl}/quotations`);
  expect(request.request.body).toEqual({...body, name: 'José', notes: 'A\nB', details: [{description: 'Llanta'}]});
  expect(body.name).toBe(' José '); request.flush({});
  const form = new FormData(); form.append('files', new Blob(['file']), 'test.pdf');
  TestBed.inject(HttpClient).post(`${environment.baseUrl}/files`, form).subscribe();
  const upload = TestBed.inject(HttpTestingController).expectOne(`${environment.baseUrl}/files`); expect(upload.request.body).toBe(form); upload.flush({});
 });
 it('does not alter external URLs or signed requests', (): void => {
  const url = 'https://example.org/file?name=%20original%20';
  TestBed.inject(HttpClient).get(url).subscribe();
  TestBed.inject(HttpTestingController).expectOne(url).flush({});
 });
 it('cleans the assisted purchase form while preserving the original invoice attachment', (): void => {
  const form = new FormData();
  const file = new File(['{"name":" Original "}'], 'invoice.json', {type: 'application/json'});
  form.append('payload', JSON.stringify({requestId: 'unchanged', provider: {name: ' Proveedor '}, details: [{description: ' Llanta '}]}));
  form.append('files', file);
  TestBed.inject(HttpClient).post(`${environment.baseUrl}/purchase-orders/assisted`, form).subscribe();
  const request = TestBed.inject(HttpTestingController).expectOne(`${environment.baseUrl}/purchase-orders/assisted`);
  const result: unknown = request.request.body;
  if (!(result instanceof FormData)) throw new Error('Expected multipart form');
  expect(result.get('payload')).toBe(JSON.stringify({requestId: 'unchanged', provider: {name: 'Proveedor'}, details: [{description: 'Llanta'}]}));
  expect(result.get('files')).toBe(file);
  request.flush({});
 });
});
