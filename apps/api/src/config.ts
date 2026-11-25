import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Cargar variables de entorno desde la raíz
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const INSECURE_DEFAULT_SECRET = 'megamundo-dev-super-secret-key-change-in-production';
const INSECURE_DEV_SECRET_2 = 'megamundo-super-secret-jwt-key-change-in-production-2026';

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
    APP_SECRET: z.string().min(1, 'APP_SECRET es obligatoria'),
    ALLOWED_ORIGINS: z.string().optional(),
    BANCOLOMBIA_INTEGRATION_ENABLED: z
      .preprocess((val) => val === 'true' || val === true, z.boolean())
      .default(false),
    BANCOLOMBIA_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
    BANCOLOMBIA_CLIENT_ID: z.string().optional().default(''),
    BANCOLOMBIA_CLIENT_SECRET: z.string().optional().default(''),
    BANCOLOMBIA_CALLBACK_URL: z.string().optional().default(''),
    ZERNIO_INTEGRATION_ENABLED: z
      .preprocess((val) => val === 'true' || val === true, z.boolean())
      .default(true),
    ZERNIO_WEBHOOK_SECRET: z.string().optional().default(''),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (
        !data.APP_SECRET ||
        data.APP_SECRET === INSECURE_DEFAULT_SECRET ||
        data.APP_SECRET === INSECURE_DEV_SECRET_2
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['APP_SECRET'],
          message: 'En producción no se permite un APP_SECRET por defecto o inseguro.',
        });
      } else if (data.APP_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['APP_SECRET'],
          message: 'En producción APP_SECRET debe tener una longitud mínima de 32 caracteres.',
        });
      }

      if (!data.ALLOWED_ORIGINS || data.ALLOWED_ORIGINS.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ALLOWED_ORIGINS'],
          message: 'En producción ALLOWED_ORIGINS debe estar explícitamente definido.',
        });
      } else if (data.ALLOWED_ORIGINS.includes('*')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ALLOWED_ORIGINS'],
          message: 'En producción no se permite el comodín "*" en ALLOWED_ORIGINS.',
        });
      }

      if (data.BANCOLOMBIA_INTEGRATION_ENABLED) {
        if (!data.BANCOLOMBIA_CLIENT_ID || data.BANCOLOMBIA_CLIENT_ID.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['BANCOLOMBIA_CLIENT_ID'],
            message: 'En producción BANCOLOMBIA_CLIENT_ID es obligatorio cuando BANCOLOMBIA_INTEGRATION_ENABLED está activo.',
          });
        }
        if (!data.BANCOLOMBIA_CLIENT_SECRET || data.BANCOLOMBIA_CLIENT_SECRET.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['BANCOLOMBIA_CLIENT_SECRET'],
            message: 'En producción BANCOLOMBIA_CLIENT_SECRET es obligatorio cuando BANCOLOMBIA_INTEGRATION_ENABLED está activo.',
          });
        }
        if (!data.BANCOLOMBIA_CALLBACK_URL || data.BANCOLOMBIA_CALLBACK_URL.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['BANCOLOMBIA_CALLBACK_URL'],
            message: 'En producción BANCOLOMBIA_CALLBACK_URL es obligatorio cuando BANCOLOMBIA_INTEGRATION_ENABLED está activo.',
          });
        }
      }
    }
  });

export function isBancolombiaConfigValid(bancolombiaConfig: {
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
}): boolean {
  return Boolean(
    bancolombiaConfig.clientId &&
    bancolombiaConfig.clientId.trim() !== '' &&
    bancolombiaConfig.clientSecret &&
    bancolombiaConfig.clientSecret.trim() !== '' &&
    bancolombiaConfig.callbackUrl &&
    bancolombiaConfig.callbackUrl.trim() !== ''
  );
}

export function parseEnv(raw: Record<string, any> = process.env) {
  const result = EnvSchema.safeParse({
    NODE_ENV: raw.NODE_ENV || 'development',
    PORT: raw.PORT || '3001',
    HOST: raw.HOST || '0.0.0.0',
    DATABASE_URL:
      raw.DATABASE_URL ||
      (raw.NODE_ENV === 'production'
        ? undefined
        : 'postgresql://postgres:postgres@localhost:5432/megamundo_payments?schema=public'),
    APP_SECRET:
      raw.APP_SECRET ||
      (raw.NODE_ENV === 'production' ? undefined : INSECURE_DEFAULT_SECRET),
    ALLOWED_ORIGINS: raw.ALLOWED_ORIGINS,
    BANCOLOMBIA_INTEGRATION_ENABLED: raw.BANCOLOMBIA_INTEGRATION_ENABLED,
    BANCOLOMBIA_ENV: raw.BANCOLOMBIA_ENV || 'sandbox',
    BANCOLOMBIA_CLIENT_ID: raw.BANCOLOMBIA_CLIENT_ID || '',
    BANCOLOMBIA_CLIENT_SECRET: raw.BANCOLOMBIA_CLIENT_SECRET || '',
    BANCOLOMBIA_CALLBACK_URL: raw.BANCOLOMBIA_CALLBACK_URL || '',
    ZERNIO_INTEGRATION_ENABLED: raw.ZERNIO_INTEGRATION_ENABLED ?? true,
    ZERNIO_WEBHOOK_SECRET: raw.ZERNIO_WEBHOOK_SECRET || '',
  });

  if (!result.success) {
    const errorMessages = result.error.errors
      .map((e) => `[CONFIG ERROR] ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Fallo crítico al validar variables de entorno:\n${errorMessages}`);
  }

  const data = result.data;
  const allowedOriginsList = data.ALLOWED_ORIGINS
    ? data.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  return {
    env: data.NODE_ENV,
    port: data.PORT,
    host: data.HOST,
    databaseUrl: data.DATABASE_URL,
    appSecret: data.APP_SECRET,
    allowedOrigins: allowedOriginsList,
    bancolombia: {
      enabled: data.BANCOLOMBIA_INTEGRATION_ENABLED,
      env: data.BANCOLOMBIA_ENV,
      clientId: data.BANCOLOMBIA_CLIENT_ID,
      clientSecret: data.BANCOLOMBIA_CLIENT_SECRET,
      callbackUrl: data.BANCOLOMBIA_CALLBACK_URL,
    },
    zernio: {
      enabled: data.ZERNIO_INTEGRATION_ENABLED,
      webhookSecret: data.ZERNIO_WEBHOOK_SECRET,
    },
  };
}

export const config = parseEnv();
