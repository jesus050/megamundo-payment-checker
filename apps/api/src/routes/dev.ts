import { FastifyInstance } from 'fastify';
import { PaymentService } from '../services/payment.service';
import { SimulatePaymentSchema } from '@megamundo/shared';

export default async function devRoutes(fastify: FastifyInstance) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  const paymentService = PaymentService.getInstance();

  /**
   * Endpoint de desarrollo y pruebas:
   * Recorre exactamente el mismo flujo interno que utilizará Bancolombia.
   */
  fastify.post('/api/dev/simulate-payment', async (request, reply) => {
    // Validar datos de simulación
    const parseResult = SimulatePaymentSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Parámetros de simulación inválidos',
        issues: parseResult.error.errors,
      });
    }

    const {
      amount,
      reference,
      accountLastDigits,
      status,
      externalEventId,
      saleNumber,
    } = parseResult.data;

    // Construir el payload simulado idéntico a una notificación de pago
    const simulatedPayload = {
      externalEventId:
        externalEventId || `mock-evt-${reference}-${Date.now()}`,
      providerPaymentId: `mock-pay-${Date.now()}`,
      reference: saleNumber || reference,
      amount,
      currency: 'COP',
      status,
      accountLastDigits,
      timestamp: new Date().toISOString(),
      simulateInvalidSignature: request.headers['x-mock-simulate-invalid-signature'] === 'true',
    };

    const rawBody = JSON.stringify(simulatedPayload);

    const result = await paymentService.processWebhook('MOCK', {
      rawBody,
      headers: {
        'content-type': 'application/json',
        'x-mock-simulate-invalid-signature': request.headers[
          'x-mock-simulate-invalid-signature'
        ],
      },
    });

    return reply.status(200).send({
      success: result.status === 'PROCESSED',
      simulatedPayload,
      result,
    });
  });
}
