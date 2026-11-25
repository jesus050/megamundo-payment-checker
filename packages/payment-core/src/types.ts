import { PaymentStatusType, PaymentProviderNameType } from '@megamundo/shared';

export interface WebhookRequest {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, any>;
}

export interface WebhookResult {
  success: boolean;
  externalEventId: string;
  eventType: string;
  signatureVerified: boolean;
  providerPaymentId: string;
  providerReference: string;
  amount: number;
  currency: string;
  status: PaymentStatusType;
  accountLastFourDigits?: string;
  paidAt?: Date;
  rawPayload: string;
  error?: string;
}

export interface PaymentIntentInput {
  businessId: string;
  amount: number;
  currency?: string;
  reference: string;
  description?: string;
  saleId?: string;
}

export interface PaymentIntentResult {
  id: string;
  provider: PaymentProviderNameType;
  reference: string;
  amount: number;
  currency: string;
  status: PaymentStatusType;
  checkoutUrl?: string;
}

export interface CreateQrInput {
  businessId: string;
  amount?: number; // Optional if static QR, required if dynamic QR
  reference: string;
  accountNumber?: string;
  expiresInSeconds?: number;
}

export interface QrResult {
  qrContent: string; // Payload / EMVco / URL
  qrImageUrl?: string;
  reference: string;
  expiresAt?: Date;
}

export interface PaymentStatusResult {
  providerPaymentId: string;
  providerReference: string;
  amount: number;
  currency: string;
  status: PaymentStatusType;
  paidAt?: Date;
  rawDetails?: Record<string, any>;
}

export interface ReconcileInput {
  startDate: Date;
  endDate: Date;
  accountNumber?: string;
}

export interface ReconcileResult {
  totalProcessed: number;
  totalAmount: number;
  matchedPayments: number;
  discrepancies: Array<{
    providerPaymentId: string;
    reason: string;
    amount: number;
  }>;
}

export type CapabilityStatus =
  | 'SUPPORTED'
  | 'NOT_SUPPORTED'
  | 'WAITING_FOR_OFFICIAL_CONTRACT'
  | 'OFFICIAL_CONTRACT_AVAILABLE'
  | 'NOT_AVAILABLE_IN_QR_CODE_3_0_1'
  | 'NOT_CONFIRMED_FOR_QR_CODE_3_0_1'
  | 'INCLUDED_IN_CREATE_QR'
  | 'NOT_AVAILABLE'
  | 'NOT_CONFIRMED'
  | 'NOT_DOCUMENTED';

export interface ProviderCapabilities {
  createQr: CapabilityStatus;
  getQr: CapabilityStatus;
  handlePaymentNotification: CapabilityStatus;
  getPaymentStatus: CapabilityStatus;
}

/**
 * Capacidades específicas del producto QR Code 3.0.1 (QR Management)
 */
export interface QrCode301Capabilities {
  createQr: 'OFFICIAL_CONTRACT_AVAILABLE';
  paymentStatus: 'NOT_AVAILABLE';
  webhook: 'NOT_CONFIRMED';
}

/**
 * Capacidades específicas del producto QR Payments Information 2.0.0 (Transactions)
 */
export interface QrPaymentsInformationCapabilities {
  retrievePaymentDetails: 'OFFICIAL_CONTRACT_AVAILABLE';
  searchByTransactionReference: 'SUPPORTED';
  searchByTrackingNumber: 'SUPPORTED';
  searchByQrId: 'NOT_SUPPORTED';
  transactionStatusApproved: 'SUPPORTED';
  completeStatusEnum: 'NOT_DOCUMENTED';
  keyValueMapping: 'NOT_CONFIRMED';
}

/**
 * Tipos oficiales para el contrato QR Code 3.0.1 (QR Management)
 */
export type BancolombiaQrNature = 'DINAMICO' | 'ESTATICO' | 'HIBRIDO';
export type BancolombiaQrPurpose = 'COMPRA';

export interface BancolombiaCreateQrRequest {
  nature: BancolombiaQrNature;
  purposeOfTransaction: BancolombiaQrPurpose;
  transactions: {
    transactionReference: string;
    amount: number;
  };
  commerce: {
    merchantId: string;
  };
}

export interface BancolombiaCreateQrResponse {
  data: {
    qrId: string;
    qrImage: string; // SVG codificado
  };
}

/**
 * Tipos oficiales para el contrato QR Payments Information 2.0.0 (POST /retrieve-details)
 */
export interface BancolombiaRetrieveDetailsRequest {
  data: {
    requestInfo: {
      keyValue: string; // "Valor de la llave asignada al QR" - WAITING_FOR_BANCOLOMBIA_CONFIRMATION
      transactionDate: string; // YYYY-MM-DD
      transactionReference?: string; // One of transactionReference or trackingNumber
      trackingNumber?: string;
    };
  };
}

export interface BancolombiaQrInfo {
  qrId: string;
  qrType?: string;
  qrVersion?: string;
  pointOfSale?: string;
  seller?: string;
  cashRegister?: string;
}

export interface BancolombiaRetrieveDetailsResponse {
  merchantId?: string;
  merchantName?: string;
  transactionDateTime?: string;
  trackingNumber?: string;
  transactionReference?: string;
  transactionStatus: string; // Único valor confirmado: 'approved'
  stateReason?: string;
  totalAmount?: number | string; // COP manejado como entero
  currency?: string;
  detailedAmount?: any;
  debtor?: string;
  debtorAccount?: string;
  creditor?: string;
  creditorAccount?: string;
  proxy?: string;
  qrInfo?: BancolombiaQrInfo;
}

/**
 * Estados canónicos de verificación interna
 */
export type InternalPaymentStatus =
  | 'APPROVED'
  | 'PAYMENT_NOT_FOUND_YET'
  | 'UNKNOWN_PROVIDER_STATUS'
  | 'REJECTED_DISCREPANCY';

export interface PaymentConfirmationCriteria {
  provider: PaymentProviderNameType | string;
  expectedAmount: number; // En pesos colombianos (COP entero)
  expectedReference: string;
  expectedQrId?: string;
}

export interface PaymentVerificationEvaluation {
  confirmed: boolean;
  status: InternalPaymentStatus;
  discrepancies: string[];
  rawDetails?: Record<string, any>;
}


/**
 * Proveedor especializado en generación y emisión de códigos QR
 */
export interface QrProvider {
  readonly name: PaymentProviderNameType;
  readonly targetProduct?: string;
  readonly capabilities?: ProviderCapabilities;
  createQr(input: CreateQrInput): Promise<QrResult>;
  getQr?(qrIdOrReference: string): Promise<QrResult>;
}

/**
 * Proveedor especializado en consulta y verificación de estado de pagos
 * (Separado conceptualmente de la generación del QR)
 */
export interface PaymentStatusProvider {
  readonly name: PaymentProviderNameType;
  readonly targetProduct?: string;
  getPaymentStatus(providerPaymentId: string): Promise<PaymentStatusResult>;
  findPaymentByReference?(reference: string): Promise<PaymentStatusResult | null>;
}

/**
 * Proveedor especializado en procesamiento de notificaciones/callbacks de pagos
 */
export interface PaymentNotificationProvider {
  readonly name: PaymentProviderNameType;
  readonly targetProduct?: string;
  handleNotification(request: WebhookRequest): Promise<WebhookResult>;
}

/**
 * Interfaz unificada de compatibilidad del sistema
 */
export interface PaymentProvider extends Partial<QrProvider>, Partial<PaymentStatusProvider>, Partial<PaymentNotificationProvider> {
  readonly name: PaymentProviderNameType;
  readonly targetProduct?: string;
  readonly capabilities?: ProviderCapabilities;

  /**
   * Procesa el webhook/callback recibido desde el proveedor.
   * Valida firma/autenticidad y retorna el resultado estandarizado.
   */
  handleWebhook(request: WebhookRequest): Promise<WebhookResult>;

  /**
   * Manejador de notificaciones de pago recibido (webhook o callback)
   */
  handlePaymentNotification?(request: WebhookRequest): Promise<WebhookResult>;

  /**
   * Crea una intención de pago o sesión (preparado para QR dinámico / checkout)
   */
  createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>;

  /**
   * Genera el contenido de un código QR para cobro en caja
   */
  createQr(input: CreateQrInput): Promise<QrResult>;

  /**
   * Consulta/obtiene un código QR previamente generado
   */
  getQr?(qrIdOrReference: string): Promise<QrResult>;

  /**
   * Consulta el estado actual de una transacción bancaria en el proveedor
   */
  getPaymentStatus(providerPaymentId: string): Promise<PaymentStatusResult>;

  /**
   * Busca pago por referencia comercial
   */
  findPaymentByReference?(reference: string): Promise<PaymentStatusResult | null>;

  /**
   * Realiza la conciliación de movimientos en un rango de fechas
   */
  reconcile(input: ReconcileInput): Promise<ReconcileResult>;
}

