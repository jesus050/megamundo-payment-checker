import { FastifyInstance } from 'fastify';
import { PaymentService } from '../services/payment.service';
import { config } from '../config';

export default async function zernioRoutes(fastify: FastifyInstance) {
  const paymentService = PaymentService.getInstance();

  /**
   * Endpoint receptor de Webhooks de Zernio para notificaciones
   * de pagos de Bancolombia vía SMS o Correo Electrónico.
   */
  fastify.post(
    '/api/webhooks/zernio',
    {
      config: {
        rateLimit: {
          max: 120,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const isEnabled =
        process.env.ZERNIO_INTEGRATION_ENABLED !== 'false' && config.zernio.enabled !== false;

      if (!isEnabled) {
        return reply.status(503).send({
          received: false,
          error: 'La integración con Zernio está actualmente deshabilitada (ZERNIO_INTEGRATION_ENABLED=false).',
          status: 'INTEGRATION_DISABLED',
        });
      }

      const rawBody =
        typeof request.body === 'string'
          ? request.body
          : JSON.stringify(request.body || {});

      try {
        const result = await paymentService.processWebhook('ZERNIO', {
          rawBody,
          headers: request.headers as Record<string, string | string[] | undefined>,
          query: request.query as Record<string, any>,
        });

        request.log.info(
          { eventId: result.eventId, status: result.status, duplicate: result.duplicate },
          'Webhook de Zernio procesado exitosamente'
        );

        return reply.status(200).send({
          received: true,
          status: result.status,
          eventId: result.eventId,
          duplicate: result.duplicate || false,
        });
      } catch (error: any) {
        request.log.error({ err: error }, 'Error al procesar webhook de Zernio');

        return reply.status(400).send({
          received: false,
          error: error.message || 'Error al procesar notificación de Zernio',
        });
      }
    }
  );
}
