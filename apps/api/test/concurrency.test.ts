import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PaymentService } from '../src/services/payment.service';
import { PaymentStatus } from '@megamundo/shared';
import { prisma } from '@megamundo/database';

describe('FASE 4: Idempotencia Concurrente en Webhooks', () => {
  const originalEnv = process.env.NODE_ENV;
  let inMemoryEvents: any[] = [];
  let inMemoryPayments: any[] = [];

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    inMemoryEvents = [];
    inMemoryPayments = [];

    vi.spyOn(prisma.paymentEvent, 'findUnique').mockImplementation(async ({ where }: any) => {
      const { provider, externalEventId } = where.provider_externalEventId;
      return (
        inMemoryEvents.find(
          (e) => e.provider === provider && e.externalEventId === externalEventId
        ) || null
      );
    });

    vi.spyOn(prisma.paymentEvent, 'create').mockImplementation(async ({ data }: any) => {
      // Simular restricción UNIQUE de base de datos (P2002) si dos llamadas intentan crear el mismo provider + externalEventId
      const existing = inMemoryEvents.find(
        (e) => e.provider === data.provider && e.externalEventId === data.externalEventId
      );
      if (existing) {
        const p2002Error: any = new Error('Unique constraint failed on the constraint: `PaymentEvent_provider_externalEventId_key`');
        p2002Error.code = 'P2002';
        throw p2002Error;
      }

      const newEvent = {
        id: `evt-${Date.now()}-${Math.random()}`,
        ...data,
        receivedAt: new Date(),
      };
      inMemoryEvents.push(newEvent);
      return newEvent;
    });

    vi.spyOn(prisma.paymentEvent, 'update').mockImplementation(async ({ where, data }: any) => {
      const idx = inMemoryEvents.findIndex((e) => e.id === where.id);
      if (idx !== -1) {
        inMemoryEvents[idx] = { ...inMemoryEvents[idx], ...data };
        return inMemoryEvents[idx];
      }
      return null;
    });

    vi.spyOn(prisma.paymentAccount, 'findFirst').mockImplementation(async () => {
      return {
        id: 'acc-5027',
        businessId: '00000000-0000-0000-0000-000000000001',
        provider: 'MOCK',
        alias: 'Cuenta Caja Principal 5027',
        lastFourDigits: '5027',
        status: 'ACTIVE',
      };
    });

    vi.spyOn(prisma.sale, 'findFirst').mockImplementation(async () => null);

    vi.spyOn(prisma.payment, 'create').mockImplementation(async ({ data }: any) => {
      const payment = {
        id: `pay-${Date.now()}-${Math.random()}`,
        ...data,
        createdAt: new Date(),
        paymentAccount: {
          alias: 'Cuenta Caja Principal 5027',
          lastFourDigits: '5027',
        },
        sale: null,
      };
      inMemoryPayments.push(payment);
      return payment;
    });

    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 'log-1' } as any);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  it('1. Debe manejar 100 llamadas concurrentes con el mismo externalEventId sin lanzar colisión P2002', async () => {
    const service = PaymentService.getInstance();
    const eventId = `concurrent-evt-${Date.now()}`;
    const payload = JSON.stringify({
      amount: 150000,
      currency: 'COP',
      reference: 'CONCURRENCY-TEST-REF',
      status: PaymentStatus.APPROVED,
      externalEventId: eventId,
      providerPaymentId: `pay-${eventId}`,
      accountLastFourDigits: '5027',
    });

    const requests = Array.from({ length: 100 }, () =>
      service.processWebhook('MOCK', {
        rawBody: payload,
        headers: {},
      })
    );

    const results = await Promise.all(requests);

    // Ninguna llamada debe haber fallado o lanzado excepción no controlada
    expect(results).toHaveLength(100);

    const processed = results.filter((r) => r.status === 'PROCESSED');
    const duplicates = results.filter(
      (r) => r.status === 'IGNORED_DUPLICATE' && r.duplicate === true
    );

    // Exactamente 1 procesado y 99 identificados como duplicados idempotentes
    expect(processed).toHaveLength(1);
    expect(duplicates).toHaveLength(99);
    expect(inMemoryPayments).toHaveLength(1);
  });
});
