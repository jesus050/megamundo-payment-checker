import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  BancolombiaQrCodeProvider,
  BancolombiaPaymentProvider,
  BancolombiaIntegrationNotConfigured,
} from '@megamundo/payment-core';
import { buildApp } from '../src/app';
import { parseEnv } from '../src/config';

describe('BancolombiaQrCodeProvider: Contrato Oficial QR Code 3.0.1 y Capacidades Confirmadas', () => {
  it('1. Debe identificar el producto objetivo como QR Code 3.0.1 y contener la metadata oficial', () => {
    const provider = new BancolombiaQrCodeProvider();
    expect(provider.targetProduct).toBe('QR Code 3.0.1');
    expect(provider.productName).toBe('QR Code - QR Management');
    expect(provider.scope).toBe('qr-codes:write:app');
    expect(provider.sandboxBaseUrl).toContain('sb/v3/sales-service');
  });

  it('2. Las capacidades deben reflejar el contrato oficial revisado', () => {
    const provider = new BancolombiaQrCodeProvider();
    expect(provider.capabilities).toEqual({
      createQr: 'OFFICIAL_CONTRACT_AVAILABLE',
      getQr: 'INCLUDED_IN_CREATE_QR',
      getPaymentStatus: 'NOT_AVAILABLE',
      handlePaymentNotification: 'NOT_CONFIRMED',
    });
    expect(provider.qrCodeCapabilities).toEqual({
      createQr: 'OFFICIAL_CONTRACT_AVAILABLE',
      paymentStatus: 'NOT_AVAILABLE',
      webhook: 'NOT_CONFIRMED',
    });
  });

  it('3. createQr() debe lanzar BancolombiaIntegrationNotConfigured con contrato oficial disponible pero integración desactivada', async () => {
    const provider = new BancolombiaQrCodeProvider();
    await expect(
      provider.createQr({
        businessId: '00000000-0000-0000-0000-000000000001',
        amount: 50000,
        reference: 'MM-QR-01',
      })
    ).rejects.toThrowError(BancolombiaIntegrationNotConfigured);
  });

  it('4. getQr() debe explicar que la imagen viene incluida en createQr (INCLUDED_IN_CREATE_QR)', async () => {
    const provider = new BancolombiaQrCodeProvider();
    await expect(provider.getQr('qr-test-ref')).rejects.toThrowError(
      /data\.qrImage/i
    );
  });

  it('5. handlePaymentNotification() debe indicar que el contrato no incluye callbacks (NOT_CONFIRMED)', async () => {
    const provider = new BancolombiaQrCodeProvider();
    await expect(
      provider.handlePaymentNotification({
        rawBody: '{}',
        headers: {},
      })
    ).rejects.toThrowError(/NOT_CONFIRMED_FOR_QR_CODE_3_0_1/i);
  });

  it('6. getPaymentStatus() debe indicar que la consulta de estado no pertenece a QR Code 3.0.1', async () => {
    const provider = new BancolombiaQrCodeProvider();
    await expect(provider.getPaymentStatus('banco-pay-123')).rejects.toThrowError(
      /NOT_AVAILABLE_IN_QR_CODE_3_0_1/i
    );
  });

  it('7. El error no debe contener credenciales ni strings de secretos', async () => {
    const provider = new BancolombiaPaymentProvider({
      clientId: 'dummy-id',
      clientSecret: 'super-sensitive-secret-value-12345',
    });

    try {
      await provider.createQr({
        businessId: 'test',
        reference: 'ref',
      });
      expect.fail('Debería haber lanzado excepción');
    } catch (error: any) {
      expect(error.message).not.toContain('super-sensitive-secret-value-12345');
      expect(error.message).toContain('QR Code 3.0.1');
    }
  });

  it('8. integración false -> BancolombiaProvider no realiza llamadas HTTP', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch' as any);
    const provider = new BancolombiaPaymentProvider({
      enabled: false,
    });

    await expect(
      provider.createQr({
        businessId: 'test-business',
        reference: 'test-ref',
      })
    ).rejects.toThrowError(BancolombiaIntegrationNotConfigured);

    await expect(
      provider.getQr('ref-123')
    ).rejects.toThrowError(BancolombiaIntegrationNotConfigured);

    await expect(
      provider.getPaymentStatus('pay-123')
    ).rejects.toThrowError(BancolombiaIntegrationNotConfigured);

    await expect(
      provider.handlePaymentNotification({
        rawBody: '{"event":"test"}',
        headers: {},
      })
    ).rejects.toThrowError(BancolombiaIntegrationNotConfigured);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('Endurecimiento Perimetral Bancolombia en Fastify y Configuración', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('1. integración false -> webhook responde 404 (ruta no registrada en Fastify)', async () => {
    process.env.BANCOLOMBIA_INTEGRATION_ENABLED = 'false';
    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/bancolombia',
      payload: { data: 'test' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('2. integración true con config incompleta -> aplicación no arranca (parseEnv falla)', () => {
    // Falta CLIENT_ID, CLIENT_SECRET y CALLBACK_URL
    expect(() => {
      parseEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://prod:prod@localhost:5432/db',
        APP_SECRET: 'super-secret-key-32-chars-long-production-valid!',
        ALLOWED_ORIGINS: 'https://pagos.megamundo.com',
        BANCOLOMBIA_INTEGRATION_ENABLED: 'true',
        BANCOLOMBIA_CLIENT_ID: '',
        BANCOLOMBIA_CLIENT_SECRET: '',
        BANCOLOMBIA_CALLBACK_URL: '',
      });
    }).toThrow(/BANCOLOMBIA_CLIENT_ID es obligatorio/i);
  });

  it('3. integración true con config incompleta en producción -> buildApp lanza fallo crítico al arrancar', () => {
    process.env.NODE_ENV = 'production';
    process.env.BANCOLOMBIA_INTEGRATION_ENABLED = 'true';
    delete process.env.BANCOLOMBIA_CLIENT_ID;
    delete process.env.BANCOLOMBIA_CLIENT_SECRET;
    delete process.env.BANCOLOMBIA_CALLBACK_URL;

    expect(() => {
      buildApp();
    }).toThrow(/No se puede arrancar la aplicación en producción con BANCOLOMBIA_INTEGRATION_ENABLED=true sin configurar/i);
  });

  it('4. integración true con config válida -> registra la ruta POST /api/webhooks/bancolombia', async () => {
    process.env.NODE_ENV = 'development';
    process.env.BANCOLOMBIA_INTEGRATION_ENABLED = 'true';
    process.env.BANCOLOMBIA_CLIENT_ID = 'valid-client-id';
    process.env.BANCOLOMBIA_CLIENT_SECRET = 'valid-client-secret';
    process.env.BANCOLOMBIA_CALLBACK_URL = 'https://pagos.megamundo.com/callback';

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/bancolombia',
      payload: { data: 'test' },
    });

    // La ruta existe (no es 404). Responderá 501 ya que el proveedor está WAITING_FOR_OFFICIAL_CONTRACT
    expect(response.statusCode).toBe(501);
  });
});

