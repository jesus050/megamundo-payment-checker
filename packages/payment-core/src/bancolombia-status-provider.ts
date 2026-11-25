import {
  PaymentStatusProvider,
  PaymentStatusResult,
  QrPaymentsInformationCapabilities,
  BancolombiaRetrieveDetailsRequest,
  BancolombiaRetrieveDetailsResponse,
  PaymentConfirmationCriteria,
  PaymentVerificationEvaluation,
  InternalPaymentStatus,
} from './types';
import { BancolombiaIntegrationNotConfigured } from './bancolombia-provider';
import { PaymentProviderName } from '@megamundo/shared';

/**
 * Proveedor para consulta de transacciones y estados de pago QR con Bancolombia.
 *
 * PRODUCTO OFICIAL: Qr Payments Information - Transactions
 * VERSIÓN: 2.0.0
 * BASE URL SANDBOX:
 * https://gw-sandbox-qa.apps.ambientesbc.com/public-partner/sb/v2/sales-service/servicing/payment-initiation/qr-payments-information/transactions
 * OPERACIÓN: POST /retrieve-details
 * SCOPE: retrieve-details-qr:read:app
 * HEADER REQUERIDO: message-id (UUID v4)
 *
 * NOTAS CRÍTICAS DE CONTRATO:
 * 1. keyValue: "Valor de la llave asignada al QR" - NO asumir keyValue == merchantId.
 *    Estado de mapeo: WAITING_FOR_BANCOLOMBIA_CONFIRMATION.
 * 2. transactionStatus: El único valor documentalmente confirmado es 'approved'.
 *    Cualquier otro valor se mapea a UNKNOWN_PROVIDER_STATUS.
 * 3. HTTP 404: "No existe información asociada con la consulta."
 *    NO tratarlo como PAYMENT_REJECTED ni NOT_PAID definitivo. Se mapea como PAYMENT_NOT_FOUND_YET.
 * 4. Autenticación: Inconsistencia entre Overview (API Key) y Operación (OAuth 2.0 Client Credentials).
 *    Estado: QR_PAYMENTS_AUTH_STATUS = WAITING_FOR_BANCOLOMBIA_CONFIRMATION.
 */
export class BancolombiaQrPaymentStatusProvider implements PaymentStatusProvider {
  readonly name = PaymentProviderName.BANCOLOMBIA;
  readonly targetProduct = 'QR Payments Information 2.0.0';
  readonly productName = 'Qr Payments Information - Transactions';
  readonly sandboxBaseUrl =
    'https://gw-sandbox-qa.apps.ambientesbc.com/public-partner/sb/v2/sales-service/servicing/payment-initiation/qr-payments-information/transactions';
  readonly scope = 'retrieve-details-qr:read:app';

  /**
   * Capacidades confirmadas en contrato para QR Payments Information 2.0.0
   */
  readonly statusCapabilities: QrPaymentsInformationCapabilities = {
    retrievePaymentDetails: 'OFFICIAL_CONTRACT_AVAILABLE',
    searchByTransactionReference: 'SUPPORTED',
    searchByTrackingNumber: 'SUPPORTED',
    searchByQrId: 'NOT_SUPPORTED',
    transactionStatusApproved: 'SUPPORTED',
    completeStatusEnum: 'NOT_DOCUMENTED',
    keyValueMapping: 'NOT_CONFIRMED',
  };

  /**
   * Mapeo canónico de transactionStatus de Bancolombia:
   * 'approved' -> APPROVED
   * Cualquier otro estado no confirmado -> UNKNOWN_PROVIDER_STATUS
   * NUNCA interpretar un estado desconocido como APPROVED.
   */
  static mapTransactionStatus(rawStatus?: string): 'APPROVED' | 'UNKNOWN_PROVIDER_STATUS' {
    if (!rawStatus) return 'UNKNOWN_PROVIDER_STATUS';
    if (rawStatus.trim().toLowerCase() === 'approved') {
      return 'APPROVED';
    }
    return 'UNKNOWN_PROVIDER_STATUS';
  }

  /**
   * Mapeo de respuesta HTTP 404 del banco ("No existe información asociada")
   */
  static handle404NotFound(): 'PAYMENT_NOT_FOUND_YET' {
    return 'PAYMENT_NOT_FOUND_YET';
  }

  /**
   * REGLA ESTRICTA DE CONFIRMACIÓN AUTOMÁTICA
   *
   * Una venta solo pasa automáticamente a APPROVED si:
   * 1. provider == BANCOLOMBIA
   * 2. transactionStatus == 'approved'
   * 3. amount == expectedAmount (entero COP, nunca float)
   * 4. transactionReference == expectedReference
   * 5. qrId == expectedQrId (cuando esté disponible)
   *
   * Si cualquier validación no coincide, NO confirmar el pago y levantar discrepancia.
   */
  static validateConfirmation(
    criteria: PaymentConfirmationCriteria,
    response: BancolombiaRetrieveDetailsResponse | { statusCode: number }
  ): PaymentVerificationEvaluation {
    const discrepancies: string[] = [];

    // Manejo de respuesta 404
    if ('statusCode' in response && response.statusCode === 404) {
      return {
        confirmed: false,
        status: 'PAYMENT_NOT_FOUND_YET',
        discrepancies: ['No existe información asociada con la consulta en Bancolombia (HTTP 404)'],
      };
    }

    const details = response as BancolombiaRetrieveDetailsResponse;

    // 1. Proveedor
    if (criteria.provider !== PaymentProviderName.BANCOLOMBIA && criteria.provider !== 'BANCOLOMBIA') {
      discrepancies.push(`Proveedor inválido: esperado BANCOLOMBIA, recibido ${criteria.provider}`);
    }

    // 2. Estado de la transacción
    const mappedStatus = this.mapTransactionStatus(details.transactionStatus);
    if (mappedStatus !== 'APPROVED') {
      discrepancies.push(
        `Estado no confirmado: '${details.transactionStatus || 'N/A'}' (mapeado como UNKNOWN_PROVIDER_STATUS)`
      );
    }

    // 3. Validación de Monto (COP manejado estrictamente como entero)
    const receivedAmount = Math.trunc(Number(details.totalAmount || 0));
    const expectedAmount = Math.trunc(Number(criteria.expectedAmount || 0));
    if (receivedAmount !== expectedAmount) {
      discrepancies.push(
        `Discrepancia en monto COP: esperado ${expectedAmount}, recibido ${receivedAmount}`
      );
    }

    // 4. Validación de Referencia de Transacción
    if (!details.transactionReference || details.transactionReference !== criteria.expectedReference) {
      discrepancies.push(
        `Discrepancia en referencia: esperada '${criteria.expectedReference}', recibida '${details.transactionReference || 'N/A'}'`
      );
    }

    // 5. Validación de qrId si está disponible en criterio y respuesta
    if (criteria.expectedQrId && details.qrInfo?.qrId) {
      if (details.qrInfo.qrId !== criteria.expectedQrId) {
        discrepancies.push(
          `Discrepancia en qrId: esperado '${criteria.expectedQrId}', recibido '${details.qrInfo.qrId}'`
        );
      }
    }

    const confirmed = discrepancies.length === 0;

    let finalStatus: InternalPaymentStatus = 'APPROVED';
    if (!confirmed) {
      if (mappedStatus === 'UNKNOWN_PROVIDER_STATUS') {
        finalStatus = 'UNKNOWN_PROVIDER_STATUS';
      } else {
        finalStatus = 'REJECTED_DISCREPANCY';
      }
    }

    return {
      confirmed,
      status: finalStatus,
      discrepancies,
      rawDetails: details,
    };
  }

  /**
   * Operación POST /retrieve-details
   * Permanece bloqueada mientras BANCOLOMBIA_INTEGRATION_ENABLED=false
   */
  async retrieveDetails(
    _input: BancolombiaRetrieveDetailsRequest
  ): Promise<BancolombiaRetrieveDetailsResponse> {
    throw new BancolombiaIntegrationNotConfigured(
      'retrieveDetails',
      'Integración deshabilitada (BANCOLOMBIA_INTEGRATION_ENABLED=false). No se realizan llamadas HTTP reales a Bancolombia POST /retrieve-details.'
    );
  }

  async getPaymentStatus(_providerPaymentId: string): Promise<PaymentStatusResult> {
    throw new BancolombiaIntegrationNotConfigured(
      'getPaymentStatus',
      'Integración deshabilitada (BANCOLOMBIA_INTEGRATION_ENABLED=false). Operación real de consulta no activada.'
    );
  }

  async findPaymentByReference(
    _reference: string
  ): Promise<PaymentStatusResult | null> {
    throw new BancolombiaIntegrationNotConfigured(
      'findPaymentByReference',
      'Integración deshabilitada (BANCOLOMBIA_INTEGRATION_ENABLED=false). Operación real de búsqueda no activada.'
    );
  }
}
