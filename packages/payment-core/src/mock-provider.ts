import {
  PaymentProvider,
  WebhookRequest,
  WebhookResult,
  PaymentIntentInput,
  PaymentIntentResult,
  CreateQrInput,
  QrResult,
  PaymentStatusResult,
  ReconcileInput,
  ReconcileResult,
} from './types';
import { ProviderStatusMapper } from './mapper';
import { PaymentProviderName, PaymentStatus } from '@megamundo/shared';

export class MockPaymentProvider implements PaymentProvider {
  readonly name = PaymentProviderName.MOCK;

  /**
   * Simula la recepción de un webhook con verificación de integridad y firma
   */
  async handleWebhook(request: WebhookRequest): Promise<WebhookResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[MockPaymentProvider] El proveedor MOCK está estrictamente deshabilitado en entornos de producción.');
    }
    try {
      const parsedBody =
        typeof request.rawBody === 'string'
          ? JSON.parse(request.rawBody)
          : request.rawBody;

      // 1. Simular chequeo de firma inválida forzada por pruebas
      const simulateInvalidSignature =
        request.headers['x-mock-simulate-invalid-signature'] === 'true' ||
        parsedBody?.simulateInvalidSignature === true;

      const signatureVerified = !simulateInvalidSignature;

      if (!signatureVerified) {
        return {
          success: false,
          externalEventId: parsedBody?.externalEventId || `mock-evt-invalid-${Date.now()}`,
          eventType: parsedBody?.eventType || 'payment.failed_signature',
          signatureVerified: false,
          providerPaymentId: parsedBody?.providerPaymentId || `mock-pay-${Date.now()}`,
          providerReference: parsedBody?.reference || 'N/A',
          amount: Number(parsedBody?.amount) || 0,
          currency: parsedBody?.currency || 'COP',
          status: PaymentStatus.ERROR,
          rawPayload: request.rawBody,
          error: 'Firma criptográfica del webhook simulado es inválida',
        };
      }

      // 2. Normalizar datos
      const externalEventId =
        parsedBody.externalEventId ||
        `mock-evt-${parsedBody.reference || Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const providerPaymentId =
        parsedBody.providerPaymentId ||
        `mock-pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const providerReference =
        parsedBody.reference || `REF-${Math.floor(100000 + Math.random() * 900000)}`;

      const amount = Number(parsedBody.amount);
      if (isNaN(amount) || amount <= 0) {
        return {
          success: false,
          externalEventId,
          eventType: 'payment.invalid_amount',
          signatureVerified: true,
          providerPaymentId,
          providerReference,
          amount: 0,
          currency: 'COP',
          status: PaymentStatus.ERROR,
          rawPayload: request.rawBody,
          error: 'El monto del pago debe ser mayor a 0',
        };
      }

      const status = ProviderStatusMapper.normalize(parsedBody.status || 'APPROVED');
      const accountLastFourDigits =
        parsedBody.accountLastDigits || parsedBody.accountLastFourDigits || '5027';

      return {
        success: true,
        externalEventId,
        eventType: `payment.${status.toLowerCase()}`,
        signatureVerified: true,
        providerPaymentId,
        providerReference,
        amount,
        currency: parsedBody.currency || 'COP',
        status,
        accountLastFourDigits,
        paidAt: status === PaymentStatus.APPROVED ? new Date() : undefined,
        rawPayload: request.rawBody,
      };
    } catch (err: any) {
      return {
        success: false,
        externalEventId: `mock-err-${Date.now()}`,
        eventType: 'webhook.parse_error',
        signatureVerified: false,
        providerPaymentId: `mock-err-${Date.now()}`,
        providerReference: 'N/A',
        amount: 0,
        currency: 'COP',
        status: PaymentStatus.ERROR,
        rawPayload: request.rawBody,
        error: `Error al procesar payload JSON: ${err?.message || 'Invalido'}`,
      };
    }
  }

  async createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    const id = `intent-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return {
      id,
      provider: this.name,
      reference: input.reference,
      amount: input.amount,
      currency: input.currency || 'COP',
      status: PaymentStatus.PENDING,
      checkoutUrl: `https://sandbox.megamundo.co/pay/${id}`,
    };
  }

  async createQr(input: CreateQrInput): Promise<QrResult> {
    const qrContent = `https://megamundo.co/qr/mock?ref=${encodeURIComponent(
      input.reference
    )}&acc=${input.accountNumber || '5027'}&amt=${input.amount || 0}`;

    return {
      qrContent,
      reference: input.reference,
      expiresAt: input.expiresInSeconds
        ? new Date(Date.now() + input.expiresInSeconds * 1000)
        : undefined,
    };
  }

  async getPaymentStatus(providerPaymentId: string): Promise<PaymentStatusResult> {
    return {
      providerPaymentId,
      providerReference: `REF-MOCK-${providerPaymentId}`,
      amount: 185000,
      currency: 'COP',
      status: PaymentStatus.APPROVED,
      paidAt: new Date(),
    };
  }

  async reconcile(_input: ReconcileInput): Promise<ReconcileResult> {
    return {
      totalProcessed: 1,
      totalAmount: 185000,
      matchedPayments: 1,
      discrepancies: [],
    };
  }
}
