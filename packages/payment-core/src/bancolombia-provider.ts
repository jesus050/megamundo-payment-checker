import {
  PaymentProvider,
  QrProvider,
  ProviderCapabilities,
  QrCode301Capabilities,
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
import { PaymentProviderName } from '@megamundo/shared';

export class BancolombiaIntegrationNotConfigured extends Error {
  readonly code = 'BANCOLOMBIA_INTEGRATION_NOT_CONFIGURED';
  readonly status = 'WAITING_FOR_OFFICIAL_CONTRACT';

  constructor(operation: string, reason?: string) {
    const detail = reason
      ? `: ${reason}`
      : ` no puede ejecutarse porque la integración con Bancolombia se encuentra deshabilitada y a la espera de aprobación y habilitación técnica.`;
    super(`[BancolombiaQrCodeProvider] La operación '${operation}'${detail}`);
    this.name = 'BancolombiaIntegrationNotConfigured';
  }
}

// Mantener compatibilidad hacia atrás
export const BancolombiaSpecificationPendingError = BancolombiaIntegrationNotConfigured;

export interface BancolombiaProviderConfig {
  enabled?: boolean;
  env?: 'sandbox' | 'production';
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
  publicKeyOrCert?: string;
}

/**
 * Proveedor oficial para generación de códigos QR con Bancolombia.
 *
 * PRODUCTO CONFIRMADO: QR Code 3.0.1 (QR Code - QR Management)
 * BASE URL SANDBOX:
 * https://gw-sandbox-qa.apps.ambientesbc.com/public-partner/sb/v3/sales-service/customer-management/customer-product-and-service-directory/qr-code/qr-management
 * OPERACIONES CONFIRMADAS EN CONTRATO:
 * - POST /qr-codes (Generación de QR)
 * - HEAD /health (Chequeo de salud)
 * SCOPE: qr-codes:write:app
 *
 * HALLAZGO ARQUITECTÓNICO CRÍTICO:
 * El contrato de QR Code 3.0.1 NO contiene consulta de estado, consulta de pago,
 * webhooks, callbacks ni eventos de pago. Por tanto, se separa conceptualmente
 * de la verificación de pagos (que corresponderá a un producto separado como
 * 'QR Payments Information 2.0.0').
 */
export class BancolombiaQrCodeProvider implements QrProvider, PaymentProvider {
  readonly name = PaymentProviderName.BANCOLOMBIA;
  readonly targetProduct = 'QR Code 3.0.1';
  readonly productName = 'QR Code - QR Management';
  readonly sandboxBaseUrl =
    'https://gw-sandbox-qa.apps.ambientesbc.com/public-partner/sb/v3/sales-service/customer-management/customer-product-and-service-directory/qr-code/qr-management';
  readonly scope = 'qr-codes:write:app';

  /**
   * Capacidades oficiales QR Code 3.0.1:
   * - createQr: OFFICIAL_CONTRACT_AVAILABLE
   * - paymentStatus: NOT_AVAILABLE
   * - webhook: NOT_CONFIRMED
   */
  readonly qrCodeCapabilities: QrCode301Capabilities = {
    createQr: 'OFFICIAL_CONTRACT_AVAILABLE',
    paymentStatus: 'NOT_AVAILABLE',
    webhook: 'NOT_CONFIRMED',
  };

  readonly capabilities: ProviderCapabilities = {
    createQr: 'OFFICIAL_CONTRACT_AVAILABLE',
    getQr: 'INCLUDED_IN_CREATE_QR',
    getPaymentStatus: 'NOT_AVAILABLE',
    handlePaymentNotification: 'NOT_CONFIRMED',
  };

  protected readonly config: BancolombiaProviderConfig;

  constructor(config: BancolombiaProviderConfig = {}) {
    this.config = {
      enabled:
        config.enabled !== undefined
          ? config.enabled
          : process.env.BANCOLOMBIA_INTEGRATION_ENABLED === 'true',
      env: (process.env.BANCOLOMBIA_ENV as 'sandbox' | 'production') || config.env || 'sandbox',
      clientId: process.env.BANCOLOMBIA_CLIENT_ID || config.clientId,
      clientSecret: process.env.BANCOLOMBIA_CLIENT_SECRET || config.clientSecret,
      callbackUrl: process.env.BANCOLOMBIA_CALLBACK_URL || config.callbackUrl,
      publicKeyOrCert: config.publicKeyOrCert,
    };
  }

  /**
   * Bloqueo preventivo de seguridad: evita cualquier ejecución o petición HTTP no autorizada.
   */
  private checkGuard(operation: string, customReason?: string): never {
    const isEnabled =
      this.config.enabled === true ||
      process.env.BANCOLOMBIA_INTEGRATION_ENABLED === 'true';

    if (!isEnabled) {
      throw new BancolombiaIntegrationNotConfigured(
        operation,
        customReason ||
          `Integración deshabilitada (BANCOLOMBIA_INTEGRATION_ENABLED=false). Producto: ${this.targetProduct}. Estado: Contrato oficial revisado, llamadas externas desactivadas.`
      );
    }

    throw new BancolombiaIntegrationNotConfigured(
      operation,
      customReason ||
        `Llamadas reales hacia Bancolombia no habilitadas aún en este entorno para el producto '${this.targetProduct}'.`
    );
  }

  /**
   * Capacidad: createQr()
   * Estado: OFFICIAL_CONTRACT_AVAILABLE
   * Requiere: nature (DINAMICO|ESTATICO|HIBRIDO), purposeOfTransaction (COMPRA),
   * transactions.transactionReference, transactions.amount, commerce.merchantId
   */
  async createQr(_input: CreateQrInput): Promise<QrResult> {
    this.checkGuard(
      'createQr',
      `Integración deshabilitada (BANCOLOMBIA_INTEGRATION_ENABLED=false). Producto: ${this.targetProduct}. Contrato oficial disponible (OFFICIAL_CONTRACT_AVAILABLE), pero las llamadas reales hacia Bancolombia permanecen desactivadas.`
    );
  }

  /**
   * Capacidad: getQr()
   * Estado: INCLUDED_IN_CREATE_QR
   * La imagen del código QR SVG viene codificada en data.qrImage dentro de createQr.
   * El contrato oficial no define un endpoint GET separado.
   */
  async getQr(_qrIdOrReference: string): Promise<QrResult> {
    throw new BancolombiaIntegrationNotConfigured(
      'getQr',
      'La imagen del QR viene incluida en la respuesta de createQr (data.qrImage). El contrato oficial de QR Code 3.0.1 no incluye un endpoint separado de consulta de imagen.'
    );
  }

  /**
   * Capacidad: handlePaymentNotification()
   * Estado: NOT_CONFIRMED_FOR_QR_CODE_3_0_1
   * QR_CALLBACK_STATUS: NEEDS_BANCOLOMBIA_CONFIRMATION
   * El producto QR Code 3.0.1 no contiene webhooks ni callbacks HTTP confirmados en su contrato.
   */
  async handlePaymentNotification(_request: WebhookRequest): Promise<WebhookResult> {
    throw new BancolombiaIntegrationNotConfigured(
      'handlePaymentNotification',
      "El producto oficial 'QR Code 3.0.1' no contiene webhooks ni callbacks en su contrato (NOT_CONFIRMED_FOR_QR_CODE_3_0_1). Estado: QR_CALLBACK_STATUS: NEEDS_BANCOLOMBIA_CONFIRMATION."
    );
  }

  /**
   * Alias de compatibilidad para notificaciones
   */
  async handleWebhook(request: WebhookRequest): Promise<WebhookResult> {
    return this.handlePaymentNotification(request);
  }

  /**
   * Capacidad: getPaymentStatus()
   * Estado: NOT_AVAILABLE_IN_QR_CODE_3_0_1
   * El producto QR Code 3.0.1 (QR Management) no incluye consulta de estado de pagos.
   * Corresponde a un producto separado (ej. 'QR Payments Information 2.0.0').
   */
  async getPaymentStatus(_providerPaymentId: string): Promise<PaymentStatusResult> {
    throw new BancolombiaIntegrationNotConfigured(
      'getPaymentStatus',
      "El producto oficial 'QR Code 3.0.1' no incluye consulta de estados de pago (NOT_AVAILABLE_IN_QR_CODE_3_0_1). Esta capacidad corresponde a un producto independiente (ej. 'QR Payments Information 2.0.0')."
    );
  }

  async findPaymentByReference(_reference: string): Promise<PaymentStatusResult | null> {
    throw new BancolombiaIntegrationNotConfigured(
      'findPaymentByReference',
      "El producto oficial 'QR Code 3.0.1' no incluye consulta de pagos por referencia (NOT_AVAILABLE_IN_QR_CODE_3_0_1)."
    );
  }

  async createPaymentIntent(_input: PaymentIntentInput): Promise<PaymentIntentResult> {
    this.checkGuard('createPaymentIntent');
  }

  async reconcile(_input: ReconcileInput): Promise<ReconcileResult> {
    this.checkGuard(
      'reconcile',
      "Conciliación no disponible en el producto 'QR Code 3.0.1'."
    );
  }
}

/**
 * Adaptador de compatibilidad con la interfaz unificada del sistema
 */
export class BancolombiaPaymentProvider extends BancolombiaQrCodeProvider {}
export const BancolombiaQrProvider = BancolombiaQrCodeProvider;
export type BancolombiaQrProvider = BancolombiaQrCodeProvider;


