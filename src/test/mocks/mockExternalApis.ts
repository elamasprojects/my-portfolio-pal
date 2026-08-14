/**
 * External API Mock Handlers & Fetch Stubs
 * Mocks ArgentinaDatos (IPC inflation & CCL FX) and DolarAPI (CCL & Oficial FX)
 */

export const ARGENTINA_DATOS_IPC_MOCK = [
  { fecha: '2024-01-01', valor: 20.6 },
  { fecha: '2024-02-01', valor: 13.2 },
  { fecha: '2024-03-01', valor: 11.0 },
  { fecha: '2024-04-01', valor: 8.8 },
  { fecha: '2024-05-01', valor: 4.2 },
  { fecha: '2024-06-01', valor: 4.6 },
];

export const ARGENTINA_DATOS_CCL_MOCK = [
  { fecha: '2024-01-01', compra: 980.0, venta: 1000.0 },
  { fecha: '2024-02-01', compra: 1180.0, venta: 1200.0 },
  { fecha: '2024-03-01', compra: 1220.0, venta: 1250.0 },
  { fecha: '2024-04-01', compra: 1280.0, venta: 1300.0 },
];

export const DOLAR_API_CCL_MOCK = {
  moneda: 'USD',
  casa: 'ccl',
  nombre: 'Contado con Liquidación',
  compra: 1240.0,
  venta: 1250.0,
  fechaActualizacion: '2026-08-14T00:00:00.000Z',
};

export const DOLAR_API_OFICIAL_MOCK = {
  moneda: 'USD',
  casa: 'oficial',
  nombre: 'Oficial',
  compra: 930.0,
  venta: 970.0,
  fechaActualizacion: '2026-08-14T00:00:00.000Z',
};

export interface ExternalApiMockOverrides {
  ipc?: typeof ARGENTINA_DATOS_IPC_MOCK;
  cclSeries?: typeof ARGENTINA_DATOS_CCL_MOCK;
  cclRate?: typeof DOLAR_API_CCL_MOCK;
  oficialRate?: typeof DOLAR_API_OFICIAL_MOCK;
}

export const externalApiHandlers = {
  'https://api.argentinadatos.com/v1/finanzas/indices/inflacion': ARGENTINA_DATOS_IPC_MOCK,
  'https://api.argentinadatos.com/v1/finanzas/cotizaciones/ccl': ARGENTINA_DATOS_CCL_MOCK,
  'https://dolarapi.com/v1/dolares/ccl': DOLAR_API_CCL_MOCK,
  'https://dolarapi.com/v1/dolares/oficial': DOLAR_API_OFICIAL_MOCK,
};

let originalFetch: typeof globalThis.fetch | null = null;

/**
 * Sets up global fetch mocking for external APIs.
 */
export function setupExternalApiMocks(overrides: ExternalApiMockOverrides = {}) {
  if (!originalFetch) {
    originalFetch = globalThis.fetch;
  }

  const ipcData = overrides.ipc || ARGENTINA_DATOS_IPC_MOCK;
  const cclSeriesData = overrides.cclSeries || ARGENTINA_DATOS_CCL_MOCK;
  const cclRateData = overrides.cclRate || DOLAR_API_CCL_MOCK;
  const oficialRateData = overrides.oficialRate || DOLAR_API_OFICIAL_MOCK;

  const mockFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (urlString.includes('/finanzas/indices/inflacion')) {
      return Promise.resolve(
        new Response(JSON.stringify(ipcData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    if (urlString.includes('/finanzas/cotizaciones/ccl')) {
      return Promise.resolve(
        new Response(JSON.stringify(cclSeriesData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    if (urlString.includes('/dolares/ccl')) {
      return Promise.resolve(
        new Response(JSON.stringify(cclRateData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    if (urlString.includes('/dolares/oficial')) {
      return Promise.resolve(
        new Response(JSON.stringify(oficialRateData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }

    // Fallback to original fetch if not an external API mock target
    if (originalFetch) {
      return originalFetch(input, init);
    }

    return Promise.resolve(
      new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  };

  globalThis.fetch = mockFetch as any;

  return {
    ipcData,
    cclSeriesData,
    cclRateData,
    oficialRateData,
    mockFetch,
  };
}

/**
 * Resets global fetch mocking to original implementation.
 */
export function resetExternalApiMocks() {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
}
