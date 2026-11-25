import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentService } from '../src/services/payment.service';
import { RealtimeService } from '../src/services/realtime.service';
import { prisma } from '@megamundo/database';

describe('Pruebas de Simulación de Pagos - Megamundo Payment Checker', () => {
  let paymentService: PaymentService;
  let broadcastSpy: any;

  // Almacén en memoria para simular PostgreSQL de manera determinista en pruebas
  let inMemoryEvents: any[] = [];
  let inMemoryPayments: any[] = [];
  let inMemorySales: any[] = [];
  let inMemoryAccounts: any[] = [];
  let inMemoryAuditLogs: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();

    inMemoryEvents = [];
    inMemoryPayments = [];
    inMemorySales = [
      {
        id: 'sale-001',
        businessId: '00000000-0000-0000-0000-000000000001',
        saleNumber: 'MM-1058',
        amount: 185000,
        currency: 'COP',
        status: 'PENDING',
      },
    ];
    inMemoryAccounts = [
      {
        id: 'acc-5027',
        businessId: '00000000-0000-0000-0000-000000000001',
        provider: 'MOCK',
        alias: 'Cuenta Caja Principal 5027',
        lastFourDigits: '5027',
        status: 'ACTIVE',
      },
    ];
    inMemoryAuditLogs = [];

    // Mock de métodos de Prisma
    vi.spyOn(prisma.paymentEvent, 'findUnique').mockImplementation(async ({ where }: any) => {
      const { provider, externalEventId } = where.provider_externalEventId;
      return (
        inMemoryEvents.find(
          (e) => e.provider === provider && e.externalEventId === externalEventId
        ) || null
      );
    });

    vi.spyOn(prisma.paymentEvent, 'create').mockImplementation(async ({ data }: any) => {
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

    vi.spyOn(prisma.paymentAccount, 'findFirst').mockImplementation(async ({ where }: any) => {
      if (where.lastFourDigits) {
        return (
          inMemoryAccounts.find(
            (a) => a.lastFourDigits === where.lastFourDigits
          ) || inMemoryAccounts[0]
        );
      }
      return inMemoryAccounts[0] || null;
    });

    vi.spyOn(prisma.sale, 'findFirst').mockImplementation(async ({ where }: any) => {
      return inMemorySales.find((s) => s.saleNumber === where.saleNumber) || null;
    });

    vi.spyOn(prisma.sale, 'update').mockImplementation(async ({ where, data }: any) => {
      const idx = inMemorySales.findIndex((s) => s.id === where.id);
      if (idx !== -1) {
        inMemorySales[idx] = { ...inMemorySales[idx], ...data };
        return inMemorySales[idx];
      }
      return null;
    });

    vi.spyOn(prisma.payment, 'create').mockImplementation(async ({ data }: any) => {
      const newPayment = {
        id: `pay-${Date.now()}-${Math.random()}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        paymentAccount: inMemoryAccounts[0],
        sale: inMemorySales.find((s) => s.id === data.saleId) || null,
      };
      inMemoryPayments.push(newPayment);
      return newPayment;
    });

    vi.spyOn(prisma.auditLog, 'create').mockImplementation(async ({ data }: any) => {
      const log = { id: `audit-${Date.now()}`, ...data, createdAt: new Date() };
      inMemoryAuditLogs.push(log);
      return log;
    });

    broadcastSpy = vi.spyOn(RealtimeService.getInstance(), 'broadcast');
    paymentService = PaymentService.getInstance();
  });

  // ESCENARIO 1: Pago aprobado
  it('1. Debe procesar exitosamente un pago aprobado (APPROVED) y emitir evento realtime', async () => {
    const rawBody = JSON.stringify({
      amount: 185000,
      reference: 'REF-APPROVED-001',
      status: 'APPROVED',
      accountLastDigits: '5027',
      externalEventId: 'evt-test-01',
    });

    const result = await paymentService.processWebhook('MOCK', {
      rawBody,
      headers: { 'content-type': 'application/json' },
    });

    expect(result.received).toBe(true);
    expect(result.status).toBe('PROCESSED');
    expect(result.paymentId).toBeDefined();

    const createdPayment = inMemoryPayments.find((p) => p.id === result.paymentId);
    expect(createdPayment).toBeDefined();
    expect(createdPayment.amount).toBe(185000);
    expect(createdPayment.status).toBe('APPROVED');
    expect(createdPayment.paidAt).toBeInstanceOf(Date);

    // Verificación de emisión por SSE en tiempo real
    expect(broadcastSpy).toHaveBeenCalledWith(
      'payment.created',
      expect.objectContaining({
        payment: expect.objectContaining({
          amount: 185000,
          status: 'APPROVED',
        }),
      })
    );
  });

  // ESCENARIO 2: Pago rechazado
  it('2. Debe registrar un pago rechazado (REJECTED) con paidAt nulo', async () => {
    const rawBody = JSON.stringify({
      amount: 50000,
      reference: 'REF-REJECTED-002',
      status: 'REJECTED',
      accountLastDigits: '5027',
      externalEventId: 'evt-test-02',
    });

    const result = await paymentService.processWebhook('MOCK', {
      rawBody,
      headers: { 'content-type': 'application/json' },
    });

    expect(result.received).toBe(true);
    expect(result.status).toBe('PROCESSED');

    const createdPayment = inMemoryPayments.find((p) => p.id === result.paymentId);
    expect(createdPayment.status).toBe('REJECTED');
    expect(createdPayment.paidAt).toBeNull();
  });

  // ESCENARIO 3: Pago pendiente
  it('3. Debe registrar un pago pendiente (PENDING) sin confirmar fondos', async () => {
    const rawBody = JSON.stringify({
      amount: 120000,
      reference: 'REF-PENDING-003',
      status: 'PENDING',
      accountLastDigits: '5027',
      externalEventId: 'evt-test-03',
    });

    const result = await paymentService.processWebhook('MOCK', {
      rawBody,
      headers: { 'content-type': 'application/json' },
    });

    expect(result.received).toBe(true);
    const createdPayment = inMemoryPayments.find((p) => p.id === result.paymentId);
    expect(createdPayment.status).toBe('PENDING');
    expect(createdPayment.paidAt).toBeNull();
  });

  // ESCENARIO 4: Dos pagos del mismo valor
  it('4. Debe admitir dos pagos del mismo valor sin colisión ni confusión entre transacciones', async () => {
    const rawBody1 = JSON.stringify({
      amount: 185000,
      reference: 'REF-PAGO-A',
      status: 'APPROVED',
      externalEventId: 'evt-same-amount-1',
    });

    const rawBody2 = JSON.stringify({
      amount: 185000,
      reference: 'REF-PAGO-B',
      status: 'APPROVED',
      externalEventId: 'evt-same-amount-2',
    });

    const res1 = await paymentService.processWebhook('MOCK', {
      rawBody: rawBody1,
      headers: { 'content-type': 'application/json' },
    });

    const res2 = await paymentService.processWebhook('MOCK', {
      rawBody: rawBody2,
      headers: { 'content-type': 'application/json' },
    });

    expect(res1.paymentId).toBeDefined();
    expect(res2.paymentId).toBeDefined();
    expect(res1.paymentId).not.toBe(res2.paymentId);

    expect(inMemoryPayments.length).toBe(2);
    expect(inMemoryPayments[0].amount).toBe(185000);
    expect(inMemoryPayments[1].amount).toBe(185000);
    expect(inMemoryPayments[0].providerReference).toBe('REF-PAGO-A');
    expect(inMemoryPayments[1].providerReference).toBe('REF-PAGO-B');
  });

  // ESCENARIO 5: Webhook duplicado (Idempotencia)
  it('5. Debe detectar un webhook duplicado y NO duplicar el pago (Idempotencia garantizada)', async () => {
    const rawBody = JSON.stringify({
      amount: 185000,
      reference: 'REF-IDEMPOTENCY',
      status: 'APPROVED',
      externalEventId: 'evt-idempotent-unique-123',
    });

    // 1er envío
    const firstResult = await paymentService.processWebhook('MOCK', {
      rawBody,
      headers: { 'content-type': 'application/json' },
    });

    expect(firstResult.status).toBe('PROCESSED');
    expect(inMemoryPayments.length).toBe(1);

    // 2do envío duplicado idéntico
    const secondResult = await paymentService.processWebhook('MOCK', {
      rawBody,
      headers: { 'content-type': 'application/json' },
    });

    expect(secondResult.received).toBe(true);
    expect(secondResult.duplicate).toBe(true);
    expect(secondResult.status).toBe('IGNORED_DUPLICATE');

    // La cantidad de pagos en base de datos NO debe cambiar
    expect(inMemoryPayments.length).toBe(1);

    // Verificación de auditoría por intento duplicado
    const auditDuplicate = inMemoryAuditLogs.find(
      (a) => a.action === 'DUPLICATE_WEBHOOK_IGNORED'
    );
    expect(auditDuplicate).toBeDefined();
  });

  // ESCENARIO 6: Firma inválida
  it('6. Debe rechazar firmas digitales inválidas y registrar incidente en auditoría', async () => {
    const rawBody = JSON.stringify({
      amount: 185000,
      reference: 'REF-BAD-SIG',
      status: 'APPROVED',
      externalEventId: 'evt-bad-sig-01',
    });

    const result = await paymentService.processWebhook('MOCK', {
      rawBody,
      headers: {
        'content-type': 'application/json',
        'x-mock-simulate-invalid-signature': 'true',
      },
    });

    expect(result.received).toBe(true);
    expect(result.status).toBe('REJECTED_SIGNATURE_INVALID');

    // No debe haberse creado ningún pago
    expect(inMemoryPayments.length).toBe(0);

    // Auditoría de seguridad obligatoria
    const securityAudit = inMemoryAuditLogs.find(
      (a) => a.action === 'INVALID_WEBHOOK_SIGNATURE'
    );
    expect(securityAudit).toBeDefined();
  });

  // ESCENARIO 7: Payload inválido
  it('7. Debe manejar adecuadamente payloads corruptos o con montos inválidos', async () => {
    const rawBody = JSON.stringify({
      amount: -100, // Monto inválido
      reference: 'REF-BAD-AMOUNT',
      status: 'APPROVED',
      externalEventId: 'evt-bad-payload',
    });

    const result = await paymentService.processWebhook('MOCK', {
      rawBody,
      headers: { 'content-type': 'application/json' },
    });

    expect(result.status).toBe('FAILED_INVALID_PAYLOAD');
    expect(inMemoryPayments.length).toBe(0);
  });

  // ESCENARIO 8: Pago sin venta asociada
  it('8. Debe permitir la existencia de pagos válidos sin una venta asociada previa', async () => {
    const rawBody = JSON.stringify({
      amount: 45000,
      reference: 'REF-NO-SALE-999',
      status: 'APPROVED',
      externalEventId: 'evt-no-sale-01',
    });

    const result = await paymentService.processWebhook('MOCK', {
      rawBody,
      headers: { 'content-type': 'application/json' },
    });

    expect(result.status).toBe('PROCESSED');
    const payment = inMemoryPayments.find((p) => p.id === result.paymentId);
    expect(payment).toBeDefined();
    expect(payment.saleId).toBeNull();
  });

  // ESCENARIO 9: Pago asociado a venta
  it('9. Debe asociar automáticamente una venta si la referencia coincide y actualizarla a PAID', async () => {
    const rawBody = JSON.stringify({
      amount: 185000,
      reference: 'MM-1058', // Coincide con la venta en inMemorySales
      status: 'APPROVED',
      externalEventId: 'evt-sale-match-01',
    });

    const result = await paymentService.processWebhook('MOCK', {
      rawBody,
      headers: { 'content-type': 'application/json' },
    });

    expect(result.status).toBe('PROCESSED');
    const payment = inMemoryPayments.find((p) => p.id === result.paymentId);
    expect(payment.saleId).toBe('sale-001');

    const updatedSale = inMemorySales.find((s) => s.id === 'sale-001');
    expect(updatedSale.status).toBe('PAID');
  });

  // ESCENARIO 10: Dos eventos simultáneos (concurrencia)
  it('10. Debe manejar eventos concurrentes procesados en paralelo sin estados inconsistentes', async () => {
    const p1 = paymentService.processWebhook('MOCK', {
      rawBody: JSON.stringify({
        amount: 30000,
        reference: 'CONCUR-01',
        status: 'APPROVED',
        externalEventId: 'evt-concur-1',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const p2 = paymentService.processWebhook('MOCK', {
      rawBody: JSON.stringify({
        amount: 40000,
        reference: 'CONCUR-02',
        status: 'APPROVED',
        externalEventId: 'evt-concur-2',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.status).toBe('PROCESSED');
    expect(r2.status).toBe('PROCESSED');
    expect(inMemoryPayments.length).toBe(2);
  });
});
