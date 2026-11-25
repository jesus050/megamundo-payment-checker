import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import authPlugin from './plugins/auth';
import { config, isBancolombiaConfigValid } from './config';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import webhookRoutes from './routes/webhooks';
import devRoutes from './routes/dev';
import paymentRoutes from './routes/payments';
import realtimeRoutes from './routes/realtime';
import auditRoutes from './routes/audit';
import zernioRoutes from './routes/zernio';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.passwordHash',
        '*.clientSecret',
        '*.secret',
      ],
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
            hostname: req.hostname,
            remoteAddress: req.ip,
          };
        },
      },
    },
  });

  // Capturar rawBody exacto para validación criptográfica de firmas de webhook
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body, done) => {
      try {
        const str = (body as string) || '{}';
        const parsed = JSON.parse(str);
        (req as any).rawBody = str;
        done(null, parsed);
      } catch (err: any) {
        err.statusCode = 400;
        done(err, undefined);
      }
    }
  );

  // Manejo seguro de errores sin filtrar internals en producción
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
      request.log.error(error);
    } else {
      request.log.warn(error);
    }

    if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Ocurrió un error interno en el servidor.',
      });
    }

    const errorMap: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      503: 'Service Unavailable',
    };

    return reply.status(statusCode).send({
      statusCode,
      error: errorMap[statusCode] || error.name || 'Error',
      message: error.message || 'Error inesperado',
    });
  });

  // Plugins de perímetro HTTP: CORS, Helmet y Rate Limiting
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : config.allowedOrigins;

  app.register(cors, {
    origin: (origin, cb) => {
      // Permitir peticiones sin origen (curl, health checks, webhooks bancarios server-to-server)
      if (!origin) {
        return cb(null, true);
      }
      // En desarrollo o test sin orígenes configurados, permitir localhost
      if (!isProd && allowedOrigins.length === 0) {
        return cb(null, true);
      }
      // Validar contra la lista blanca explícita
      if (allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error('Bloqueado por política CORS: origen no autorizado'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'"], // Permite SSE /api/realtime/stream
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  app.register(rateLimit, {
    global: true,
    max: process.env.NODE_ENV === 'test' ? 1000 : 100,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Has superado el límite de peticiones permitidas. Intenta de nuevo en ${context.after}.`,
    }),
  });

  // Autenticación JWT
  app.register(authPlugin);

  // Endurecimiento de integración Bancolombia:
  const isBancolombiaEnabled =
    process.env.BANCOLOMBIA_INTEGRATION_ENABLED === 'true' ||
    (process.env.BANCOLOMBIA_INTEGRATION_ENABLED === undefined && config.bancolombia.enabled);

  const bancolombiaCredentials = {
    clientId: process.env.BANCOLOMBIA_CLIENT_ID ?? config.bancolombia.clientId,
    clientSecret: process.env.BANCOLOMBIA_CLIENT_SECRET ?? config.bancolombia.clientSecret,
    callbackUrl: process.env.BANCOLOMBIA_CALLBACK_URL ?? config.bancolombia.callbackUrl,
  };

  const isConfigValid = isBancolombiaConfigValid(bancolombiaCredentials);

  // En producción, si la integración está habilitada pero faltan variables requeridas, abortar arranque
  if (isProd && isBancolombiaEnabled && !isConfigValid) {
    throw new Error(
      'Fallo crítico: No se puede arrancar la aplicación en producción con BANCOLOMBIA_INTEGRATION_ENABLED=true sin configurar BANCOLOMBIA_CLIENT_ID, BANCOLOMBIA_CLIENT_SECRET y BANCOLOMBIA_CALLBACK_URL.'
    );
  }

  // Registro de rutas
  app.register(healthRoutes);
  app.register(authRoutes);

  // Solo registrar POST /api/webhooks/bancolombia cuando la integración está habilitada y su configuración es válida
  if (isBancolombiaEnabled && isConfigValid) {
    app.register(webhookRoutes);
  }

  if (process.env.NODE_ENV !== 'production') {
    app.register(devRoutes);
  }
  app.register(paymentRoutes);
  app.register(realtimeRoutes);
  app.register(auditRoutes);
  app.register(zernioRoutes);

  // Servir frontend compilado en producción (Monorepo All-in-One para Render/VPS)
  const webDistPath = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDistPath)) {
    app.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
      wildcard: false,
    });

    app.setNotFoundHandler((req, reply) => {
      const url = req.raw.url || '';
      if (url.startsWith('/api')) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Route ${req.method}:${url} not found`,
        });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
