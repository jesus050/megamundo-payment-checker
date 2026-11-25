import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../src/app';
import { PaymentProviderRegistry, MockPaymentProvider } from '@megamundo/payment-core';
import { PaymentService } from '../src/services/payment.service';

describe('FASE 1: Aislamiento de Desarrollo y Bloqueo de MOCK en Producción', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it('1. /api/dev/simulate-payment NO debe existir (404) en NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/dev/simulate-payment',
      payload: {
        amount: 185000,
        reference: 'MM-TEST-PROD',
        status: 'APPROVED',
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('2. MockPaymentProvider debe arrojar error si se intenta ejecutar en producción', async () => {
    process.env.NODE_ENV = 'production';
    const mock = new MockPaymentProvider();

    await expect(
      mock.handleWebhook({
        rawBody: JSON.stringify({ amount: 185000, status: 'APPROVED' }),
        headers: {},
      })
    ).rejects.toThrow(/deshabilitado en entornos de producción/i);
  });

  it('3. PaymentProviderRegistry debe rechazar el registro manual de MockPaymentProvider en producción', () => {
    process.env.NODE_ENV = 'production';
    const registry = PaymentProviderRegistry.getInstance();

    expect(() => {
      registry.register(new MockPaymentProvider());
    }).toThrow(/no está permitido registrar mockpaymentprovider en entornos de producción/i);
  });

  it('4. PaymentService.processWebhook debe rechazar invocar MOCK en producción', async () => {
    process.env.NODE_ENV = 'production';
    const service = PaymentService.getInstance();

    await expect(
      service.processWebhook('MOCK', {
        rawBody: JSON.stringify({ amount: 185000 }),
        headers: {},
      })
    ).rejects.toThrow(/deshabilitado en entornos de producción/i);
  });
});
