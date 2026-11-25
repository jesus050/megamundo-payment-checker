import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../src/app';
import { RealtimeService } from '../src/services/realtime.service';
import { prisma } from '@megamundo/database';

describe('Resiliencia y Conectividad en Tiempo Real (Escenarios 11 y 12)', () => {
  let app: any;

  beforeEach(() => {
    vi.clearAllMocks();
    app = buildApp();
  });

  // ESCENARIO 11: Base de datos temporalmente no disponible
  it('11. Debe responder degraded (503) en /api/health cuando la DB está caída sin provocar caída del proceso', async () => {
    // Simular falla de conexión a base de datos
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(
      new Error('Connection to database timed out: ECONNREFUSED')
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.body);

    expect(body.status).toBe('degraded');
    expect(body.services.api.status).toBe('ok');
    expect(body.services.database.status).toBe('disconnected');
    expect(body.services.realtime.status).toBe('ok');
  });

  // ESCENARIO 12: Dashboard desconectado y posteriormente reconectado
  it('12. Debe gestionar la desconexión y reconexión de clientes SSE sin fugas de memoria', async () => {
    const realtimeService = RealtimeService.getInstance();
    const initialClients = realtimeService.getConnectedClientsCount();

    // 1. Simular conexión de cliente 1 (Dashboard)
    const writeCalls: string[] = [];
    const mockReply1: any = {
      raw: {
        write: vi.fn((data: string) => {
          writeCalls.push(data);
          return true;
        }),
      },
    };

    realtimeService.addClient('client-dashboard-1', mockReply1);
    expect(realtimeService.getConnectedClientsCount()).toBe(initialClients + 1);

    // Debe haber recibido el mensaje de bienvenida
    expect(mockReply1.raw.write).toHaveBeenCalledWith(
      expect.stringContaining('event: connected')
    );

    // 2. Transmitir evento con cliente conectado
    realtimeService.broadcast('payment.created', {
      payment: { id: 'pay-test-12', amount: 185000 },
    });

    expect(mockReply1.raw.write).toHaveBeenCalledWith(
      expect.stringContaining('event: payment.created')
    );

    // 3. Simular desconexión del cliente 1
    realtimeService.removeClient('client-dashboard-1');
    expect(realtimeService.getConnectedClientsCount()).toBe(initialClients);

    // 4. Emitir un evento cuando está desconectado (no debe fallar)
    expect(() => {
      realtimeService.broadcast('payment.created', {
        payment: { id: 'pay-test-offline', amount: 75500 },
      });
    }).not.toThrow();

    // 5. Simular reconexión posterior (Cliente 2 - Reconexión)
    const mockReplyReconnected: any = {
      raw: {
        write: vi.fn(),
      },
    };

    realtimeService.addClient('client-dashboard-reconnected', mockReplyReconnected);
    expect(realtimeService.getConnectedClientsCount()).toBe(initialClients + 1);

    // 6. Transmitir evento a cliente reconectado
    realtimeService.broadcast('payment.created', {
      payment: { id: 'pay-test-online-again', amount: 185000 },
    });

    expect(mockReplyReconnected.raw.write).toHaveBeenCalledWith(
      expect.stringContaining('pay-test-online-again')
    );

    // Limpieza
    realtimeService.removeClient('client-dashboard-reconnected');
  });
});
