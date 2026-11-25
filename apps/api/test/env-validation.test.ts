import { describe, it, expect, vi } from 'vitest';
import { parseEnv } from '../src/config';
import { buildApp } from '../src/app';

describe('FASE 2: Validación de Entorno Segura con Zod', () => {
  it('1. Debe fallar en producción si APP_SECRET es el valor por defecto inseguro', () => {
    expect(() => {
      parseEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://prod:prod@prod-db:5432/db',
        APP_SECRET: 'megamundo-dev-super-secret-key-change-in-production',
        ALLOWED_ORIGINS: 'https://pagos.megamundo.com',
      });
    }).toThrow(/APP_SECRET por defecto o inseguro/i);
  });

  it('2. Debe fallar en producción si APP_SECRET tiene menos de 32 caracteres', () => {
    expect(() => {
      parseEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://prod:prod@prod-db:5432/db',
        APP_SECRET: 'clave-demasiado-corta-123',
        ALLOWED_ORIGINS: 'https://pagos.megamundo.com',
      });
    }).toThrow(/longitud mínima de 32 caracteres/i);
  });

  it('3. Debe fallar en producción si ALLOWED_ORIGINS no está definido o contiene "*"', () => {
    // Sin ALLOWED_ORIGINS
    expect(() => {
      parseEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://prod:prod@prod-db:5432/db',
        APP_SECRET: 'super-secret-key-32-chars-long-production-valid!',
        ALLOWED_ORIGINS: '',
      });
    }).toThrow(/ALLOWED_ORIGINS debe estar explícitamente definido/i);

    // Con comodín "*"
    expect(() => {
      parseEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://prod:prod@prod-db:5432/db',
        APP_SECRET: 'super-secret-key-32-chars-long-production-valid!',
        ALLOWED_ORIGINS: '*',
      });
    }).toThrow(/no se permite el comodín "\*" en ALLOWED_ORIGINS/i);
  });

  it('4. BANCOLOMBIA_INTEGRATION_ENABLED debe ser false por defecto y el webhook responder 404 (no registrado)', async () => {
    const parsed = parseEnv({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/db',
      APP_SECRET: 'dev-secret-key-long-enough-32-chars!',
    });

    expect(parsed.bancolombia.enabled).toBe(false);

    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/bancolombia',
      payload: { some: 'payload' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('5. Debe aceptar configuración válida y segura en producción', () => {
    const valid = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://prod_user:strong_pass@prod-db:5432/megamundo',
      APP_SECRET: 'b819f72a4c104e1e82e3f5a01bc8939e6a9f4d1e2c3b4a5d6e7f8a9b0c1d2e3f',
      ALLOWED_ORIGINS: 'https://pagos.megamundo.com, https://admin.megamundo.com',
      BANCOLOMBIA_INTEGRATION_ENABLED: 'false',
    });

    expect(valid.env).toBe('production');
    expect(valid.allowedOrigins).toEqual([
      'https://pagos.megamundo.com',
      'https://admin.megamundo.com',
    ]);
    expect(valid.bancolombia.enabled).toBe(false);
  });
});
