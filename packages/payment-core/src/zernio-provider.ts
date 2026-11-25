import * as crypto from 'crypto';
import {
  PaymentProvider,
  PaymentNotificationProvider,
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
import { PaymentProviderName, PaymentStatus } from '@megamundo/shared';

export interface ZernioProviderConfig {
  webhookSecret?: string;
  enforceSignature?: boolean;
}

export interface ExtractedBancolombiaData {
  amount: number;
  comprobante: string;
  reference?: string;
  accountLastFourDigits?: string;
  payerName?: string;
  channel: 'SMS' | 'EMAIL' | 'UNKNOWN';
  rawText: string;
}

/**
 * Proveedor para procesar webhooks de Zernio que retransmiten
 * notificaciones de pago de Bancolombia (por SMS o Correo Electrónico).
 */
export class ZernioNotificationProvider implements PaymentProvider, PaymentNotificationProvider {
  readonly name = PaymentProviderName.ZERNIO;
  readonly targetProduct = 'Zernio Omnichannel (Bancolombia SMS/Email Inbound)';

  private readonly config: ZernioProviderConfig;

  constructor(config: ZernioProviderConfig = {}) {
    this.config = {
      webhookSecret: config.webhookSecret || process.env.ZERNIO_WEBHOOK_SECRET,
      enforceSignature: config.enforceSignature ?? Boolean(process.env.ZERNIO_WEBHOOK_SECRET),
    };
  }

  /**
   * Extrae el monto en pesos colombianos (entero) a partir del texto
   */
  static extractCopAmount(text: string): number | null {
    // Busca patrones como: "$185,000", "$185.000", "$185.000,00", "COP 185000", "valor de $185.000"
    const amountRegex = /(?:\$|COP\s*|valor\s+de\s+\$|por\s+\$)\s*([\d\.,]+)/i;
    const match = text.match(amountRegex);
    if (!match || !match[1]) return null;

    let clean = match[1].trim();

    // Si termina en decimales ,00 o .00 los eliminamos
    if (/[\.,]\d{2}$/.test(clean)) {
      clean = clean.slice(0, -3);
    }

    // Remueve puntos y comas de miles
    clean = clean.replace(/[\.,]/g, '');

    const parsed = parseInt(clean, 10);
    return isNaN(parsed) || parsed <= 0 ? null : parsed;
  }

  /**
   * Extrae el número de comprobante o autorización
   */
  static extractComprobante(text: string): string | null {
    // Patrones: "comprobante 12345678", "comprobante: 12345678", "número de comprobante: 88776655"
    // NOTA: No usar "código" solo porque "código QR" es la modalidad de pago, no el comprobante.
    const compRegex =
      /(?:\bn[uú]mero\s+(?:de\s+)?comprobante|\bcomprobante|\baprobaci[oó]n|\bautorizaci[oó]n|\brecibo\s+n[uú]mero|\btransacci[oó]n\s+n[uú]mero)[:\s#]*([a-zA-Z0-9]+)/i;
    const match = text.match(compRegex);
    if (match && match[1]) {
      const val = match[1].trim();
      if (!/^(?:de|por|con|el|la|en|qr|cuenta)$/i.test(val)) {
        return val;
      }
    }

    // Búsqueda secundaria si hay formato directo "comprobante: 12345" o solo números tras comprobante
    const secMatch = text.match(/\bcomprobante\s*[:#]?\s*([0-9]+)/i);
    if (secMatch && secMatch[1]) {
      return secMatch[1].trim();
    }

    return null;
  }

  /**
   * Extrae la referencia comercial si el cliente o comercio la incluyó
   */
  static extractReference(text: string): string | null {
    // Patrones: "referencia MM-1058", "ref: MM-1058", "factura MM-1058"
    const refRegex = /(?:referencia|ref|factura|venta)[:\s#]*([a-zA-Z0-9\-_]+)/i;
    const match = text.match(refRegex);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  }

  /**
   * Extrae los últimos 4 dígitos de la cuenta de destino
   */
  static extractAccountDigits(text: string): string | null {
    // Patrones: "cuenta *5027", "cta 5027", "terminada en 5027"
    const accRegex = /(?:cuenta|cta|terminada\s+en)[\s\*]*(\d{4})/i;
    const match = text.match(accRegex);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  }

  /**
   * Parser agnóstico para SMS o Correo de Bancolombia
   */
  static parseNotification(payload: any): ExtractedBancolombiaData | null {
    let rawText = '';
    let channel: 'SMS' | 'EMAIL' | 'UNKNOWN' = 'UNKNOWN';

    if (typeof payload === 'string') {
      rawText = payload;
    } else if (payload && typeof payload === 'object') {
      // Evento de Zernio: message.received o email.received
      const data = payload.data || payload;
      const isEmail =
        payload.event?.includes('email') ||
        Boolean(data.subject || data.emailId || (data.from && String(data.from).includes('@')));

      channel = isEmail ? 'EMAIL' : 'SMS';

      const parts = [
        data.subject,
        data.body,
        data.text,
        data.content,
        data.message,
        typeof data === 'string' ? data : '',
      ].filter(Boolean);

      rawText = parts.join(' ');
    }

    if (!rawText || rawText.trim().length === 0) {
      return null;
    }

    // Comprobar indicios de que es una notificación bancaria de Bancolombia
    const lower = rawText.toLowerCase();
    const isBancolombia =
      lower.includes('bancolombia') ||
      lower.includes('transferencia') ||
      lower.includes('recepcion') ||
      lower.includes('abono') ||
      lower.includes('pago recibido');

    if (!isBancolombia) {
      return null;
    }

    const amount = this.extractCopAmount(rawText);
    if (!amount) {
      return null;
    }

    let comprobante = this.extractComprobante(rawText);
    const reference = this.extractReference(rawText);
    const accountLastFourDigits = this.extractAccountDigits(rawText);

    // Si el texto no traía la palabra comprobante explícita, se usa el ID del payload o un hash determinista
    if (!comprobante) {
      const payloadId = payload?.data?.id || payload?.id;
      if (payloadId) {
        comprobante = `ZERNIO-${payloadId}`;
      } else {
        // Hash determinista del texto para evitar duplicados accidentales
        const hash = crypto.createHash('md5').update(rawText).digest('hex').substring(0, 10);
        comprobante = `ZER-${hash}`;
      }
    }

    return {
      amount,
      comprobante,
      reference: reference || undefined,
      accountLastFourDigits: accountLastFourDigits || undefined,
      channel,
      rawText,
    };
  }

  /**
   * Valida la firma del webhook de Zernio (X-Zernio-Signature) si hay secreto configurado
   */
  verifySignature(rawBody: string, headers: Record<string, string | string[] | undefined>): boolean {
    const secret = this.config.webhookSecret;
    if (!secret) {
      // Si no hay secreto configurado, se permite para facilitar desarrollo y testing local
      return true;
    }

    const signature = (headers['x-zernio-signature'] ||
      headers['X-Zernio-Signature'] ||
      headers['x-signature']) as string | undefined;

    if (!signature) {
      return false;
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const expected = hmac.digest('hex');

    return signature === expected || signature.includes(expected);
  }

  /**
   * Procesa la notificación entrante de Zernio
   */
  async handleWebhook(request: WebhookRequest): Promise<WebhookResult> {
    const signatureVerified = this.verifySignature(request.rawBody, request.headers);

    if (!signatureVerified && this.config.enforceSignature) {
      return {
        success: false,
        externalEventId: `zernio-invalid-${Date.now()}`,
        eventType: 'zernio.invalid_signature',
        signatureVerified: false,
        providerPaymentId: '',
        providerReference: '',
        amount: 0,
        currency: 'COP',
        status: PaymentStatus.ERROR,
        rawPayload: request.rawBody,
        error: 'Firma X-Zernio-Signature inválida o ausente',
      };
    }

    let parsedPayload: any;
    try {
      parsedPayload =
        typeof request.rawBody === 'string' ? JSON.parse(request.rawBody) : request.rawBody;
    } catch {
      parsedPayload = request.rawBody;
    }

    const extracted = ZernioNotificationProvider.parseNotification(parsedPayload);

    if (!extracted) {
      return {
        success: false,
        externalEventId: `zernio-unrecognized-${Date.now()}`,
        eventType: 'zernio.unrecognized_format',
        signatureVerified,
        providerPaymentId: '',
        providerReference: '',
        amount: 0,
        currency: 'COP',
        status: PaymentStatus.ERROR,
        rawPayload: request.rawBody,
        error: 'El contenido del mensaje no contiene un formato de pago válido de Bancolombia',
      };
    }

    const eventId = `ZER-${extracted.comprobante}`;

    return {
      success: true,
      externalEventId: eventId,
      eventType: `zernio.bancolombia.${extracted.channel.toLowerCase()}`,
      signatureVerified,
      providerPaymentId: extracted.comprobante,
      providerReference: extracted.reference || extracted.comprobante,
      amount: extracted.amount,
      currency: 'COP',
      status: PaymentStatus.APPROVED,
      accountLastFourDigits: extracted.accountLastFourDigits || '5027',
      paidAt: new Date(),
      rawPayload: request.rawBody,
    };
  }

  async handleNotification(request: WebhookRequest): Promise<WebhookResult> {
    return this.handleWebhook(request);
  }

  async createPaymentIntent(_input: PaymentIntentInput): Promise<PaymentIntentResult> {
    throw new Error('ZernioNotificationProvider solo recibe notificaciones de pago (SMS/Email). No emite intenciones de cobro directas.');
  }

  async createQr(_input: CreateQrInput): Promise<QrResult> {
    throw new Error('ZernioNotificationProvider no genera códigos QR. Utilice BancolombiaQrProvider para la emisión de QR.');
  }

  async getPaymentStatus(_providerPaymentId: string): Promise<PaymentStatusResult> {
    throw new Error('ZernioNotificationProvider es un receptor de eventos pasivo. Utilice BancolombiaQrPaymentStatusProvider para sondeo activo.');
  }

  async reconcile(_input: ReconcileInput): Promise<ReconcileResult> {
    throw new Error('Conciliación masiva no soportada directamente por ZernioNotificationProvider.');
  }
}
