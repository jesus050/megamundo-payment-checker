import { FastifyInstance } from 'fastify';
import { PaymentService } from '../services/payment.service';

export default async function webhookRoutes(fastify: FastifyInstance) {
  const paymentService = PaymentService.getInstance();

  /**
   * Endpoint oficial para el webhook / callback de Bancolombia.
   * Diseñado para responder en milisegundos (< 200ms) cumpliendo la exigencia bancaria.
   */
  fastify.post(
    '/api/webhooks/bancolombia',
    {
      config: {
        rateLimit: {
          max: 120,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const rawBody =
        typeof request.body === 'string'
          ? request.body
          : JSON.stringify(request.body || {});

    try {
      const result = await paymentService.processWebhook('BANCOLOMBIA', {
        rawBody,
        headers: request.headers as Record<string, string | string[] | undefined>,
        query: request.query as Record<string, any>,
      });

      // Retornar código exitoso para confirmar recepción al banco
      return reply.status(200).send({
        received: true,
        status: result.status,
        eventId: result.eventId,
        duplicate: result.duplicate || false,
      });
    } catch (error: any) {
      request.log.error({ err: error }, 'Error al procesar callback de Bancolombia');

      // Si la integración o especificación oficial aún está pendiente (WAITING_FOR_OFFICIAL_CONTRACT)
      if (
        error?.name === 'BancolombiaIntegrationNotConfigured' ||
        error?.name === 'BancolombiaSpecificationPendingError'
      ) {
        return reply.status(501).send({
          received: false,
          error: error.message,
          status: 'WAITING_FOR_OFFICIAL_CONTRACT',
        });
      }

      return reply.status(400).send({
        received: false,
        error: error.message || 'Error al procesar webhook',
      });
    }
  });
}
