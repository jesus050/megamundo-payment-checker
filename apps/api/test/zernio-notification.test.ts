import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as crypto from 'crypto';
import { ZernioNotificationProvider } from '@megamundo/payment-core';
import { buildApp } from '../src/app';
import { prisma } from '@megamundo/database';

describe('ZernioNotificationProvider: Parser de SMS y Correos de Bancolombia', () => {
  it('1. Debe extraer monto y comprobante desde un SMS de transferencia estándar', () => {
    const smsText =
      'Bancolombia le informa recepcion transferencia por $185,000 en su cuenta *5027 comprobante 12345678';

    const extracted = ZernioNotificationProvider.parseNotification({
      event: 'message.received',
      data: {
        from: '85555',
        body: smsText,
        id: 'msg_001',
      },
    });

    expect(extracted).not.toBeNull();
    expect(extracted?.amount).toBe(185000);
    expect(extracted?.comprobante).toBe('12345678');
    expect(extracted?.accountLastFourDigits).toBe('5027');
    expect(extracted?.channel).toBe('SMS');
  });

  it('2. Debe procesar un SMS con formato de pago QR Bancolombia y referencia comercial', () => {
    const smsQrText =
      'Bancolombia: Pago recibido con codigo QR por $75.500. Referencia: MM-1059. Comprobante: 98765432.';

    const extracted = ZernioNotificationProvider.parseNotification({
      event: 'message.received',
      data: {
        from: 'Bancolombia',
        text: smsQrText,
      },
    });

    expect(extracted).not.toBeNull();
    expect(extracted?.amount).toBe(75500);
    expect(extracted?.comprobante).toBe('98765432');
    expect(extracted?.reference).toBe('MM-1059');
  });

  it('3. Debe procesar un correo de notificación de Bancolombia', () => {
    const emailPayload = {
      event: 'email.received',
      data: {
        from: 'notificaciones@notificacionesbancolombia.com',
        subject: 'Comprobante de transferencia recibida',
        body: 'Hola Comercializadora Megamundo S.A.S., Te confirmamos una transferencia por valor de $185.000,00 a tu cuenta de ahorros terminada en 5027. Número de comprobante: 88776655. Referencia: MM-1058.',
        id: 'eml_999',
      },
    };

    const extracted = ZernioNotificationProvider.parseNotification(emailPayload);

    expect(extracted).not.toBeNull();
    expect(extracted?.amount).toBe(185000);
    expect(extracted?.comprobante).toBe('88776655');
    expect(extracted?.reference).toBe('MM-1058');
    expect(extracted?.accountLastFourDigits).toBe('5027');
    expect(extracted?.channel).toBe('EMAIL');
  });

  it('4. Debe rechazar textos que no correspondan a pagos o transferencias de Bancolombia', () => {
    const spamText = 'Tu código de verificación de WhatsApp es 123-456.';

    const extracted = ZernioNotificationProvider.parseNotification({
      data: { body: spamText },
    });

    expect(extracted).toBeNull();
  });

  it('5. Debe verificar la firma HMAC SHA-256 de Zernio si hay secreto configurado', async () => {
    const secret = 'super-zernio-secret-test';
    const provider = new ZernioNotificationProvider({
      webhookSecret: secret,
      enforceSignature: true,
    });

    const rawBody = JSON.stringify({
      data: {
        body: 'Bancolombia recepcion transferencia por $50,000 comprobante 554433 cuenta *5027',
      },
    });

    const validSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    // Con firma válida
    const validResult = await provider.handleWebhook({
      rawBody,
      headers: {
        'x-zernio-signature': validSignature,
      },
    });
    expect(validResult.success).toBe(true);
    expect(validResult.amount).toBe(50000);
    expect(validResult.signatureVerified).toBe(true);

    // Con firma manipulada o ausente
    const invalidResult = await provider.handleWebhook({
      rawBody,
      headers: {
        'x-zernio-signature': 'bad-signature',
      },
    });
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.signatureVerified).toBe(false);
    expect(invalidResult.error).toContain('Firma');
  });
});

describe('Endpoint POST /api/webhooks/zernio', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('6. Debe procesar webhook entrante de Zernio y responder 200 con eventId', async () => {
    const app = buildApp();
    await app.ready();

    // Mockeamos la creación en Prisma para pruebas limpias
    vi.spyOn(prisma.paymentEvent, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma.paymentEvent, 'create').mockResolvedValue({
      id: 'evt-zernio-1',
      provider: 'ZERNIO',
      externalEventId: 'ZER-112233',
      eventType: 'zernio.bancolombia.sms',
      rawPayload: '{}',
      signatureVerified: true,
      receivedAt: new Date(),
      processedAt: new Date(),
      processingStatus: 'PROCESSED',
      paymentId: 'pay-zernio-1',
    } as any);
    vi.spyOn(prisma.paymentEvent, 'update').mockResolvedValue({
      id: 'evt-zernio-1',
      provider: 'ZERNIO',
      externalEventId: 'ZER-112233',
      eventType: 'zernio.bancolombia.sms',
      rawPayload: '{}',
      signatureVerified: true,
      receivedAt: new Date(),
      processedAt: new Date(),
      processingStatus: 'PROCESSED',
      paymentId: 'pay-1',
    } as any);

    vi.spyOn(prisma.paymentAccount, 'findFirst').mockResolvedValue({
      id: 'acc-5027',
      businessId: '00000000-0000-0000-0000-000000000001',
      provider: 'BANCOLOMBIA',
      alias: 'Cuenta Principal',
      lastFourDigits: '5027',
      status: 'ACTIVE',
    } as any);

    vi.spyOn(prisma.sale, 'findFirst').mockResolvedValue({
      id: 'sale-1058',
      businessId: '00000000-0000-0000-0000-000000000001',
      saleNumber: 'MM-1058',
      amount: 185000,
      currency: 'COP',
      status: 'PENDING',
    } as any);
    vi.spyOn(prisma.sale, 'update').mockResolvedValue({
      id: 'sale-1058',
      status: 'PAID',
    } as any);

    vi.spyOn(prisma.payment, 'create').mockResolvedValue({
      id: 'pay-1',
      businessId: '00000000-0000-0000-0000-000000000001',
      paymentAccountId: 'acc-5027',
      saleId: 'sale-1058',
      provider: 'ZERNIO',
      providerPaymentId: '112233',
      providerReference: 'MM-1058',
      amount: 185000,
      currency: 'COP',
      status: 'APPROVED',
      paymentAccount: {
        id: 'acc-5027',
        alias: 'Cuenta Principal',
        lastFourDigits: '5027',
      },
      sale: {
        id: 'sale-1058',
        saleNumber: 'MM-1058',
        amount: 185000,
        status: 'PAID',
      },
    } as any);

    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as any);

    const response = await app.inject({
      method: 'POST',
      url: '/api/webhooks/zernio',
      payload: {
        event: 'message.received',
        data: {
          from: '85555',
          body: 'Bancolombia: Pago recibido con codigo QR por $185.000. Referencia: MM-1058. Comprobante: 112233.',
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.received).toBe(true);
    expect(body.status).toBe('PROCESSED');
    expect(body.eventId).toBe('evt-zernio-1');
  });
});
