import { z } from 'zod';

// ==========================================
// ESTADOS AGNOSTICOS DEL SISTEMA DE PAGOS
// ==========================================
export const PaymentStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  ERROR: 'ERROR',
} as const;

export type PaymentStatusType = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentStatusEnum = z.enum([
  'PENDING',
  'PROCESSING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'REFUNDED',
  'ERROR',
]);

// ==========================================
// ROLES DE USUARIO
// ==========================================
export const UserRole = {
  ADMIN: 'ADMIN',
  CASHIER: 'CASHIER',
  VIEWER: 'VIEWER',
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export const UserRoleEnum = z.enum(['ADMIN', 'CASHIER', 'VIEWER']);

// ==========================================
// PROVEEDORES SOPORTADOS Y PREPARADOS
// ==========================================
export const PaymentProviderName = {
  MOCK: 'MOCK',
  BANCOLOMBIA: 'BANCOLOMBIA',
  ZERNIO: 'ZERNIO',
  WOMPI: 'WOMPI',
  BOLD: 'BOLD',
  NEQUI: 'NEQUI',
  MERCADOPAGO: 'MERCADOPAGO',
} as const;

export type PaymentProviderNameType =
  (typeof PaymentProviderName)[keyof typeof PaymentProviderName];

// ==========================================
// ESTADO DE PROCESAMIENTO DE EVENTOS
// ==========================================
export const EventProcessingStatus = {
  RECEIVED: 'RECEIVED',
  PROCESSED: 'PROCESSED',
  IGNORED_DUPLICATE: 'IGNORED_DUPLICATE',
  FAILED: 'FAILED',
} as const;

export type EventProcessingStatusType =
  (typeof EventProcessingStatus)[keyof typeof EventProcessingStatus];

// ==========================================
// ESQUEMAS ZOD DE VALIDACION
// ==========================================

export const LoginSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(8, { message: 'La contraseña debe tener al menos 8 caracteres' }),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const SimulatePaymentSchema = z.object({
  amount: z.number().positive({ message: 'El monto debe ser positivo' }),
  reference: z.string().min(1, { message: 'La referencia es requerida' }),
  accountLastDigits: z.string().min(4).max(4).default('5027'),
  status: PaymentStatusEnum.default('APPROVED'),
  provider: z.string().default('MOCK'),
  externalEventId: z.string().optional(),
  saleNumber: z.string().optional(),
});
export type SimulatePaymentInput = z.infer<typeof SimulatePaymentSchema>;

export const AssociateSaleSchema = z.object({
  saleNumber: z.string().min(1, { message: 'El número de venta es requerido' }),
  notes: z.string().optional(),
});
export type AssociateSaleInput = z.infer<typeof AssociateSaleSchema>;

export const PaymentFilterSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reference: z.string().optional(),
  saleNumber: z.string().optional(),
  account: z.string().optional(),
  status: PaymentStatusEnum.optional(),
  lastMinutes: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type PaymentFilterInput = z.infer<typeof PaymentFilterSchema>;

// ==========================================
// FORMATEO DE MONEDA Y FECHA (COP)
// ==========================================

export function formatCurrencyCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatTimeShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);
}

export function formatDateFull(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);
}


