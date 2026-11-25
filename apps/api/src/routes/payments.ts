import { FastifyInstance } from 'fastify';
import { PaymentService } from '../services/payment.service';
import {
  PaymentFilterSchema,
  AssociateSaleSchema,
  UserRole,
} from '@megamundo/shared';

export default async function paymentRoutes(fastify: FastifyInstance) {
  const paymentService = PaymentService.getInstance();

  /**
   * Consulta de pagos con filtros avanzados (monto, referencia, venta, últimos 15 min, etc.)
   */
  fastify.get(
    '/api/payments',
    {
      preHandler: [fastify.authenticate],
      config: {
        rateLimit: {
          max: process.env.NODE_ENV === 'test' ? 500 : 60,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parseResult = PaymentFilterSchema.safeParse(request.query);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Parámetros de consulta inválidos',
          issues: parseResult.error.errors,
        });
      }

      const payments = await paymentService.getPayments(
        parseResult.data,
        request.user.businessId
      );

      return reply.send({
        total: payments.length,
        payments,
      });
    }
  );

  /**
   * Consulta un pago individual con sus eventos asociados
   */
  fastify.get(
    '/api/payments/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const payment = await paymentService.getPaymentById(
        id,
        request.user.businessId
      );

      if (!payment) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Pago no encontrado',
        });
      }

      return reply.send({ payment });
    }
  );

  /**
   * Asociar manualmente un pago a una venta (Permitido a ADMIN y CASHIER)
   * Un cajero NO puede modificar montos ni estados, solo asociar a una venta existente o número de factura.
   */
  fastify.post(
    '/api/payments/:id/associate-sale',
    {
      preHandler: [
        fastify.authenticate,
        fastify.authorize([UserRole.ADMIN, UserRole.CASHIER]),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = AssociateSaleSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Datos de asociación inválidos',
          issues: parseResult.error.errors,
        });
      }

      try {
        const updatedPayment = await paymentService.associatePaymentToSale(
          id,
          parseResult.data.saleNumber,
          request.user.id,
          request.user.businessId
        );

        return reply.send({
          success: true,
          message: 'Pago asociado a la venta exitosamente',
          payment: updatedPayment,
        });
      } catch (error: any) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: error.message || 'No se pudo asociar el pago',
        });
      }
    }
  );
}
