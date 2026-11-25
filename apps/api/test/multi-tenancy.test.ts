import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../src/app';
import { RealtimeService } from '../src/services/realtime.service';
import { PaymentService } from '../src/services/payment.service';
import { UserRole } from '@megamundo/shared';

describe('FASE 3: Autorización y Multi-Tenancy', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(async () => {
    app = buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    RealtimeService.getInstance().cleanup();
    vi.restoreAllMocks();
  });

  it('1. Debe rechazar la conexión a /api/realtime/stream si no se suministra token (401)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/realtime/stream',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Unauthorized');
  });

  it('2. Debe rechazar la conexión a /api/realtime/stream si el token es inválido', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/realtime/stream?token=invalid-token-string',
    });

    expect(response.statusCode).toBe(401);
  });

  it('3. RealtimeService debe aislar broadcasts entre diferentes comercios (multi-tenancy)', () => {
    const realtime = RealtimeService.getInstance();
    const businessA = 'tenant-aaa-111';
    const businessB = 'tenant-bbb-222';

    const clientAWrites: string[] = [];
    const clientBWrites: string[] = [];

    const mockReplyA: any = {
      raw: {
        write: (chunk: string) => clientAWrites.push(chunk),
      },
    };

    const mockReplyB: any = {
      raw: {
        write: (chunk: string) => clientBWrites.push(chunk),
      },
    };

    realtime.addClient('client-a', mockReplyA, businessA);
    realtime.addClient('client-b', mockReplyB, businessB);

    // Initial connected event is sent to each client
    expect(clientAWrites.length).toBe(1);
    expect(clientAWrites[0]).toContain(businessA);
    expect(clientBWrites.length).toBe(1);
    expect(clientBWrites[0]).toContain(businessB);

    // Broadcast for Business A
    realtime.broadcast('payment.created', {
      payment: {
        id: 'pay-1',
        amount: 50000,
        businessId: businessA,
      },
    });

    // Client A received the event, Client B DID NOT
    expect(clientAWrites.length).toBe(2);
    expect(clientAWrites[1]).toContain('pay-1');
    expect(clientBWrites.length).toBe(1); // Still 1

    // Broadcast for Business B
    realtime.broadcast('payment.created', {
      payment: {
        id: 'pay-2',
        amount: 80000,
        businessId: businessB,
      },
    });

    // Client B received pay-2, Client A did not receive pay-2
    expect(clientAWrites.length).toBe(2);
    expect(clientBWrites.length).toBe(2);
    expect(clientBWrites[1]).toContain('pay-2');
  });

  it('4. Consulta de /api/payments debe filtrar estrictamente por el businessId del token JWT', async () => {
    const businessA = 'tenant-alpha-001';
    const tokenA = app.jwt.sign({
      id: 'user-a',
      email: 'admin@tenant-alpha.com',
      role: UserRole.ADMIN,
      businessId: businessA,
    });

    const getPaymentsSpy = vi.spyOn(PaymentService.getInstance(), 'getPayments')
      .mockResolvedValueOnce([] as any);

    const response = await app.inject({
      method: 'GET',
      url: '/api/payments',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });

    expect(response.statusCode).toBe(200);
    // Verificamos que se le pasó a getPayments el businessId del token
    expect(getPaymentsSpy).toHaveBeenCalledWith(
      expect.anything(),
      businessA
    );
  });
});
