import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../src/app';

describe('FASE 5, 6 y 7: Perímetro HTTP, Autenticación y Manejo Seguro de Errores', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalOrigins = process.env.ALLOWED_ORIGINS;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.ALLOWED_ORIGINS = originalOrigins;
    vi.restoreAllMocks();
  });

  it('1. Debe incluir cabeceras de seguridad Helmet y CSP que permita connect-src "self"', async () => {
    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect([200, 503]).toContain(response.statusCode);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    const csp = response.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    await app.close();
  });

  it('2. CORS: debe rechazar orígenes no autorizados cuando está en producción', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://pagos.megamundo.co';

    const app = buildApp();
    await app.ready();

    // Origen autorizado
    const allowedRes = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: {
        origin: 'https://pagos.megamundo.co',
      },
    });
    expect(allowedRes.headers['access-control-allow-origin']).toBe('https://pagos.megamundo.co');

    // Origen malicioso o no autorizado
    const blockedRes = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: {
        origin: 'https://malicious-site.com',
      },
    });
    // Fastify CORS arroja error o bloquea cabecera allow-origin
    expect(blockedRes.headers['access-control-allow-origin']).toBeUndefined();

    await app.close();
  });

  it('3. Rate Limiting: debe responder 429 Too Many Requests cuando se excede la cuota', async () => {
    const app = buildApp();
    app.register(async (instance) => {
      instance.get(
        '/test-rate-limit',
        {
          config: {
            rateLimit: {
              max: 2,
              timeWindow: '1 minute',
            },
          },
        },
        async () => ({ ok: true })
      );
    });

    await app.ready();

    const res1 = await app.inject({ method: 'GET', url: '/test-rate-limit' });
    expect(res1.statusCode).toBe(200);

    const res2 = await app.inject({ method: 'GET', url: '/test-rate-limit' });
    expect(res2.statusCode).toBe(200);

    const res3 = await app.inject({ method: 'GET', url: '/test-rate-limit' });
    expect(res3.statusCode).toBe(429);
    const body = JSON.parse(res3.body);
    expect(body.error).toBe('Too Many Requests');

    await app.close();
  });

  it('4. Auth: contraseñas menores a 8 caracteres deben ser rechazadas con 400', async () => {
    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'cajero@megamundo.com',
        password: 'short', // 5 caracteres < 8
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toContain('inválidos');
    expect(body.issues[0].message).toContain('al menos 8 caracteres');

    await app.close();
  });

  it('5. Auth: tokens expirados o alterados deben ser rechazados con 401', async () => {
    const app = buildApp();
    await app.ready();

    // Token manipulado
    const tamperedRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature',
      },
    });
    expect(tamperedRes.statusCode).toBe(401);

    // Token expirado (expiración fijada en el pasado)
    const expiredToken = app.jwt.sign(
      {
        id: 'usr-1',
        email: 'test@megamundo.co',
        role: 'ADMIN',
        businessId: '001',
        exp: Math.floor(Date.now() / 1000) - 3600,
      }
    );

    const expiredRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        Authorization: `Bearer ${expiredToken}`,
      },
    });
    expect(expiredRes.statusCode).toBe(401);

    await app.close();
  });

  it('6. Manejo de Errores: en producción no debe filtrar detalles de stack traces ni mensajes internos', async () => {
    process.env.NODE_ENV = 'production';
    const app = buildApp();
    app.get('/test-error', async () => {
      throw new Error('SELECT * FROM "Secret_Table" WHERE internal_leak = 1;');
    });

    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/test-error',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Ocurrió un error interno en el servidor.');
    expect(body.message).not.toContain('SELECT');
    expect(body.stack).toBeUndefined();

    await app.close();
  });
});
