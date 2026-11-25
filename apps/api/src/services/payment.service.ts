import { prisma, PaymentStatus as DbPaymentStatus } from '@megamundo/database';
import {
  PaymentProviderRegistry,
  WebhookRequest,
  WebhookResult,
} from '@megamundo/payment-core';
import {
  PaymentFilterInput,
  PaymentStatus,
} from '@megamundo/shared';
import { RealtimeService } from './realtime.service';
import { AuditService } from './audit.service';

export interface ProcessWebhookResponse {
  received: boolean;
  duplicate?: boolean;
  eventId?: string;
  paymentId?: string;
  status: string;
  error?: string;
}

export class PaymentService {
  private static instance: PaymentService;
  private realtime = RealtimeService.getInstance();
  private audit = AuditService.getInstance();
  private registry = PaymentProviderRegistry.getInstance();

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * Procesa un webhook recibido de cualquier proveedor registrado
   */
  async processWebhook(
    providerName: string,
    request: WebhookRequest,
    businessId?: string
  ): Promise<ProcessWebhookResponse> {
    if (providerName.toUpperCase() === 'MOCK' && process.env.NODE_ENV === 'production') {
      throw new Error('Operación no permitida: MockPaymentProvider está estrictamente deshabilitado en entornos de producción.');
    }
    const provider = this.registry.get(providerName);

    // 1. Delegar al proveedor la verificación criptográfica y extracción de datos
    const webhookResult: WebhookResult = await provider.handleWebhook(request);

    const defaultBusinessId =
      businessId || '00000000-0000-0000-0000-000000000001';

    // 2. Comprobar Idempotencia usando (provider + externalEventId)
    if (webhookResult.externalEventId) {
      const existingEvent = await prisma.paymentEvent.findUnique({
        where: {
          provider_externalEventId: {
            provider: provider.name,
            externalEventId: webhookResult.externalEventId,
          },
        },
      });

      if (existingEvent) {
        // Notificación duplicada del banco
        await this.audit.log({
          businessId: defaultBusinessId,
          action: 'DUPLICATE_WEBHOOK_IGNORED',
          entityType: 'PaymentEvent',
          entityId: existingEvent.id,
          metadata: {
            provider: provider.name,
            externalEventId: webhookResult.externalEventId,
          },
        });

        return {
          received: true,
          duplicate: true,
          eventId: existingEvent.id,
          paymentId: existingEvent.paymentId || undefined,
          status: 'IGNORED_DUPLICATE',
        };
      }
    }

    // 3. Registrar el PaymentEvent antes de procesar lógica de negocio
    let paymentEvent;
    try {
      paymentEvent = await prisma.paymentEvent.create({
        data: {
          provider: provider.name,
          externalEventId: webhookResult.externalEventId,
          eventType: webhookResult.eventType,
          rawPayload: webhookResult.rawPayload,
          signatureVerified: webhookResult.signatureVerified,
          processingStatus: webhookResult.signatureVerified ? 'RECEIVED' : 'FAILED',
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002' || err.message?.includes('Unique constraint failed')) {
        const existingEvent = await prisma.paymentEvent.findUnique({
          where: {
            provider_externalEventId: {
              provider: provider.name,
              externalEventId: webhookResult.externalEventId!,
            },
          },
        });

        await this.audit.log({
          businessId: defaultBusinessId,
          action: 'CONCURRENT_DUPLICATE_WEBHOOK_IGNORED',
          entityType: 'PaymentEvent',
          entityId: existingEvent?.id || 'unknown',
          metadata: {
            provider: provider.name,
            externalEventId: webhookResult.externalEventId,
          },
        });

        return {
          received: true,
          duplicate: true,
          eventId: existingEvent?.id,
          paymentId: existingEvent?.paymentId || undefined,
          status: 'IGNORED_DUPLICATE',
        };
      }
      throw err;
    }

    // 4. Si la firma es inválida, rechazar y registrar auditoría de seguridad
    if (!webhookResult.signatureVerified) {
      await this.audit.log({
        businessId: defaultBusinessId,
        action: 'INVALID_WEBHOOK_SIGNATURE',
        entityType: 'PaymentEvent',
        entityId: paymentEvent.id,
        metadata: {
          provider: provider.name,
          error: webhookResult.error || 'Firma inválida',
        },
      });

      return {
        received: true,
        eventId: paymentEvent.id,
        status: 'REJECTED_SIGNATURE_INVALID',
        error: webhookResult.error || 'Firma digital inválida',
      };
    }

    // 5. Si la estructura o monto es inválido
    if (!webhookResult.success) {
      await prisma.paymentEvent.update({
        where: { id: paymentEvent.id },
        data: { processingStatus: 'FAILED', processedAt: new Date() },
      });

      await this.audit.log({
        businessId: defaultBusinessId,
        action: 'INVALID_WEBHOOK_PAYLOAD',
        entityType: 'PaymentEvent',
        entityId: paymentEvent.id,
        metadata: {
          error: webhookResult.error,
        },
      });

      return {
        received: true,
        eventId: paymentEvent.id,
        status: 'FAILED_INVALID_PAYLOAD',
        error: webhookResult.error,
      };
    }

    // 6. Localizar la cuenta receptora del negocio
    let account = await prisma.paymentAccount.findFirst({
      where: {
        businessId: defaultBusinessId,
        lastFourDigits: webhookResult.accountLastFourDigits || '5027',
      },
    });

    if (!account) {
      // Tomar la primera cuenta activa del negocio o crear una si no existe
      account = await prisma.paymentAccount.findFirst({
        where: { businessId: defaultBusinessId },
      });

      if (!account) {
        account = await prisma.paymentAccount.create({
          data: {
            businessId: defaultBusinessId,
            provider: provider.name,
            providerAccountId: `ACC-${webhookResult.accountLastFourDigits || '5027'}`,
            alias: `Cuenta ${provider.name} ****${webhookResult.accountLastFourDigits || '5027'}`,
            lastFourDigits: webhookResult.accountLastFourDigits || '5027',
          },
        });
      }
    }

    // 7. Buscar si hay una venta asociada por referencia o número de venta
    let matchedSale = null;
    if (webhookResult.providerReference) {
      matchedSale = await prisma.sale.findFirst({
        where: {
          businessId: defaultBusinessId,
          saleNumber: webhookResult.providerReference,
        },
      });
    }

    // 8. Crear o actualizar el Payment
    const payment = await prisma.payment.create({
      data: {
        businessId: defaultBusinessId,
        paymentAccountId: account.id,
        saleId: matchedSale?.id || null,
        provider: provider.name,
        providerPaymentId: webhookResult.providerPaymentId,
        providerReference: webhookResult.providerReference,
        amount: webhookResult.amount,
        currency: webhookResult.currency,
        status: webhookResult.status as DbPaymentStatus,
        paidAt: webhookResult.paidAt || (webhookResult.status === PaymentStatus.APPROVED ? new Date() : null),
      },
      include: {
        paymentAccount: true,
        sale: true,
      },
    });

    // 9. Actualizar el evento con el ID del pago y estado PROCESSED
    paymentEvent = await prisma.paymentEvent.update({
      where: { id: paymentEvent.id },
      data: {
        paymentId: payment.id,
        processingStatus: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    // 10. Si la venta fue encontrada y el pago es APPROVED, actualizar venta a PAID
    if (matchedSale && webhookResult.status === PaymentStatus.APPROVED) {
      await prisma.sale.update({
        where: { id: matchedSale.id },
        data: { status: 'PAID' },
      });
    }

    // 11. Auditoría
    await this.audit.log({
      businessId: defaultBusinessId,
      action: 'PAYMENT_PROCESSED_FROM_WEBHOOK',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: {
        provider: provider.name,
        amount: payment.amount,
        status: payment.status,
        reference: payment.providerReference,
        saleId: payment.saleId,
      },
    });

    // 12. Notificar inmediatamente por el canal en tiempo real SSE
    this.realtime.broadcast('payment.created', {
      payment: {
        id: payment.id,
        businessId: payment.businessId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        provider: payment.provider,
        reference: payment.providerReference,
        providerPaymentId: payment.providerPaymentId,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        account: {
          alias: payment.paymentAccount.alias,
          lastFourDigits: payment.paymentAccount.lastFourDigits,
        },
        sale: payment.sale
          ? {
              id: payment.sale.id,
              saleNumber: payment.sale.saleNumber,
            }
          : null,
      },
    });

    return {
      received: true,
      eventId: paymentEvent.id,
      paymentId: payment.id,
      status: 'PROCESSED',
    };
  }

  /**
   * Consulta filtrada de pagos con soporte para búsqueda rápida en caja
   */
  async getPayments(filters: PaymentFilterInput, businessId?: string) {
    const defaultBusinessId =
      businessId || '00000000-0000-0000-0000-000000000001';

    const whereClause: any = {
      businessId: defaultBusinessId,
    };

    if (filters.amount !== undefined) {
      whereClause.amount = filters.amount;
    }

    if (filters.reference) {
      whereClause.providerReference = {
        contains: filters.reference,
        mode: 'insensitive',
      };
    }

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.account) {
      whereClause.paymentAccount = {
        lastFourDigits: {
          contains: filters.account,
        },
      };
    }

    if (filters.saleNumber) {
      whereClause.sale = {
        saleNumber: {
          contains: filters.saleNumber,
          mode: 'insensitive',
        },
      };
    }

    if (filters.lastMinutes) {
      const minutesAgo = new Date(Date.now() - filters.lastMinutes * 60 * 1000);
      whereClause.createdAt = {
        gte: minutesAgo,
      };
    }

    return await prisma.payment.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
      include: {
        paymentAccount: {
          select: {
            alias: true,
            lastFourDigits: true,
            provider: true,
          },
        },
        sale: {
          select: {
            id: true,
            saleNumber: true,
            amount: true,
            status: true,
          },
        },
      },
    });
  }

  async getPaymentById(id: string, businessId?: string) {
    const defaultBusinessId =
      businessId || '00000000-0000-0000-0000-000000000001';

    return await prisma.payment.findFirst({
      where: {
        id,
        businessId: defaultBusinessId,
      },
      include: {
        paymentAccount: true,
        sale: true,
        events: {
          orderBy: { receivedAt: 'desc' },
        },
      },
    });
  }

  /**
   * Asocia manualmente un pago a una venta. Permitido a CASHIER y ADMIN.
   */
  async associatePaymentToSale(
    paymentId: string,
    saleNumber: string,
    userId: string,
    businessId: string
  ) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, businessId },
    });

    if (!payment) {
      throw new Error('Pago no encontrado');
    }

    let sale = await prisma.sale.findFirst({
      where: { businessId, saleNumber },
    });

    // Si la venta no existe aún, se registra como venta iniciada por caja
    if (!sale) {
      sale = await prisma.sale.create({
        data: {
          businessId,
          saleNumber,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status === 'APPROVED' ? 'PAID' : 'PENDING',
        },
      });
    }

    const previousSaleId = payment.saleId;

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: { saleId: sale.id },
      include: {
        paymentAccount: true,
        sale: true,
      },
    });

    // Registrar en auditoría
    await this.audit.log({
      businessId,
      userId,
      action: 'ASSOCIATE_PAYMENT_TO_SALE',
      entityType: 'Payment',
      entityId: paymentId,
      metadata: {
        saleNumber,
        saleId: sale.id,
        previousSaleId,
      },
    });

    // Notificar actualización en tiempo real
    this.realtime.broadcast(
      'payment.updated',
      {
        payment: updatedPayment,
      }
    );

    return updatedPayment;
  }
}
