import { HttpRequest, HttpResponse } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { apiEnvelopeInterceptor } from './api-envelope.interceptor';

async function run(body: unknown) {
  const request = new HttpRequest('GET', '/api/test');
  return firstValueFrom(
    apiEnvelopeInterceptor(request, () =>
      of(new HttpResponse({ body, status: 200 })),
    ),
  );
}

describe('apiEnvelopeInterceptor', () => {
  it('conserva respuestas paginadas', async () => {
    const body = { data: [{ id: 1 }], meta: { total: 1 } };
    const response = (await run(body)) as HttpResponse<unknown>;

    expect(response.body).toEqual(body);
  });

  it('desenvuelve objetos y conserva el mensaje', async () => {
    const response = (await run({
      data: { id: 1, name: 'Marca' },
      message: 'Marca creada correctamente',
    })) as HttpResponse<unknown>;

    expect(response.body).toEqual({
      id: 1,
      name: 'Marca',
      message: 'Marca creada correctamente',
    });
  });

  it('desenvuelve arrays y conserva respuestas directas', async () => {
    const arrayResponse = (await run({ data: [{ id: 1 }] })) as HttpResponse<unknown>;
    const directResponse = (await run({ id: 1 })) as HttpResponse<unknown>;

    expect(arrayResponse.body).toEqual([{ id: 1 }]);
    expect(directResponse.body).toEqual({ id: 1 });
  });
});
