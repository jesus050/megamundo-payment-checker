import { describe, it, expect } from 'vitest';
import {
  BancolombiaQrPaymentStatusProvider,
  BancolombiaRetrieveDetailsResponse,
  PaymentConfirmationCriteria,
  PaymentVerificationPoller,
} from '@megamundo/payment-core';

describe('Bancolombia QR Payments Information: Validación y Regla de Confirmación', () => {
  const baseFixture: BancolombiaRetrieveDetailsResponse = {
    merchantId: 'MCH-001',
    merchantName: 'Comercializadora Megamundo',
    transactionDateTime: '2026-09-22T10:30:00Z',
    transactionReference: 'MM-000123',
    transactionStatus: 'approved',
    totalAmount: 185000,
    currency: 'COP',
    qrInfo: {
      qrId: 'qr-banco-999',
      qrType: 'DINAMICO',
    },
  };

  const criteria: PaymentConfirmationCriteria = {
    provider: 'BANCOLOMBIA',
    expectedAmount: 185000,
    expectedReference: 'MM-000123',
    expectedQrId: 'qr-banco-999',
  };

  it('1. approved -> APPROVED (confirmación exitosa)', () => {
    const result = BancolombiaQrPaymentStatusProvider.validateConfirmation(
      criteria,
      baseFixture
    );

    expect(result.confirmed).toBe(true);
    expect(result.status).toBe('APPROVED');
    expect(result.discrepancies).toHaveLength(0);
  });

  it('2. status desconocido -> UNKNOWN_PROVIDER_STATUS (nunca interpretar como APPROVED)', () => {
    const fixtureWithUnknownStatus: BancolombiaRetrieveDetailsResponse = {
      ...baseFixture,
      transactionStatus: 'in_process_custom_status',
    };

    const result = BancolombiaQrPaymentStatusProvider.validateConfirmation(
      criteria,
      fixtureWithUnknownStatus
    );

    expect(result.confirmed).toBe(false);
    expect(result.status).toBe('UNKNOWN_PROVIDER_STATUS');
    expect(result.discrepancies.some((d) => d.includes('UNKNOWN_PROVIDER_STATUS'))).toBe(true);
  });

  it('3. amount incorrecto -> no confirmar y levantar discrepancia de monto', () => {
    const fixtureWithWrongAmount: BancolombiaRetrieveDetailsResponse = {
      ...baseFixture,
      totalAmount: 150000, // Esperado es 185000
    };

    const result = BancolombiaQrPaymentStatusProvider.validateConfirmation(
      criteria,
      fixtureWithWrongAmount
    );

    expect(result.confirmed).toBe(false);
    expect(result.status).toBe('REJECTED_DISCREPANCY');
    expect(result.discrepancies.some((d) => d.includes('monto COP'))).toBe(true);
  });

  it('4. transactionReference incorrecta -> no confirmar y levantar discrepancia', () => {
    const fixtureWithWrongRef: BancolombiaRetrieveDetailsResponse = {
      ...baseFixture,
      transactionReference: 'MM-OTRA-VENTA-999',
    };

    const result = BancolombiaQrPaymentStatusProvider.validateConfirmation(
      criteria,
      fixtureWithWrongRef
    );

    expect(result.confirmed).toBe(false);
    expect(result.status).toBe('REJECTED_DISCREPANCY');
    expect(result.discrepancies.some((d) => d.includes('referencia'))).toBe(true);
  });

  it('5. qrId diferente -> no confirmar cuando qrId esté disponible', () => {
    const fixtureWithWrongQrId: BancolombiaRetrieveDetailsResponse = {
      ...baseFixture,
      qrInfo: {
        qrId: 'qr-otro-comercio-111',
      },
    };

    const result = BancolombiaQrPaymentStatusProvider.validateConfirmation(
      criteria,
      fixtureWithWrongQrId
    );

    expect(result.confirmed).toBe(false);
    expect(result.status).toBe('REJECTED_DISCREPANCY');
    expect(result.discrepancies.some((d) => d.includes('qrId'))).toBe(true);
  });

  it('6. 404 -> PAYMENT_NOT_FOUND_YET (no tratar como rechazado ni prueba de no pago)', () => {
    const response404 = { statusCode: 404 };

    const result = BancolombiaQrPaymentStatusProvider.validateConfirmation(
      criteria,
      response404
    );

    expect(result.confirmed).toBe(false);
    expect(result.status).toBe('PAYMENT_NOT_FOUND_YET');
    expect(result.discrepancies.some((d) => d.includes('HTTP 404'))).toBe(true);
  });
});

describe('PaymentVerificationPoller: Comportamiento de Sondeo Controlado', () => {
  it('7. polling se detiene inmediatamente al recibir approved', async () => {
    const poller = new PaymentVerificationPoller({
      initialIntervalMs: 5,
      totalTimeoutMs: 500,
    });

    let attemptsCount = 0;
    const mockQuery = async () => {
      attemptsCount++;
      if (attemptsCount === 3) {
        return {
          confirmed: true,
          status: 'APPROVED' as const,
          discrepancies: [],
        };
      }
      return {
        confirmed: false,
        status: 'PAYMENT_NOT_FOUND_YET' as const,
        discrepancies: ['No encontrado aún'],
      };
    };

    // Función sleep inmediata para pruebas ultrarrápidas
    const instantSleep = async () => {};

    const pollerResult = await poller.poll(mockQuery, instantSleep);

    expect(pollerResult.success).toBe(true);
    expect(pollerResult.timeout).toBe(false);
    expect(pollerResult.attempts).toBe(3);
    expect(pollerResult.lastEvaluation?.status).toBe('APPROVED');
  });

  it('8. polling termina al llegar al timeout total', async () => {
    const poller = new PaymentVerificationPoller({
      initialPhaseThresholdMs: 20,
      initialIntervalMs: 10,
      middlePhaseThresholdMs: 40,
      middleIntervalMs: 10,
      lateIntervalMs: 10,
      totalTimeoutMs: 30, // Timeout muy corto para el test
    });

    let attemptsCount = 0;
    const mockQueryAlways404 = async () => {
      attemptsCount++;
      return {
        confirmed: false,
        status: 'PAYMENT_NOT_FOUND_YET' as const,
        discrepancies: ['HTTP 404'],
      };
    };

    const instantSleep = async () => {};

    const pollerResult = await poller.poll(mockQueryAlways404, instantSleep);

    expect(pollerResult.success).toBe(false);
    expect(pollerResult.timeout).toBe(true);
    expect(attemptsCount).toBeGreaterThanOrEqual(2);
  });
});
