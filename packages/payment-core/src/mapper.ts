import { PaymentStatus, PaymentStatusType } from '@megamundo/shared';

export class ProviderStatusMapper {
  /**
   * Mapea estados externos heterogéneos al estado interno estandarizado.
   * Evita que nombres bancarios particulares se filtren en la lógica del negocio.
   */
  static normalize(rawStatus: string | undefined | null): PaymentStatusType {
    if (!rawStatus) return PaymentStatus.PENDING;

    const normalized = rawStatus.trim().toUpperCase();

    switch (normalized) {
      // Casos aprobados
      case 'APPROVED':
      case 'APROBADA':
      case 'SUCCESS':
      case 'SUCCESSFUL':
      case 'COMPLETED':
      case 'PAGADO':
      case 'AUTHORIZED':
        return PaymentStatus.APPROVED;

      // Casos rechazados / fallidos
      case 'REJECTED':
      case 'RECHAZADA':
      case 'DECLINED':
      case 'FAILED':
      case 'FALLIDA':
      case 'DENIED':
        return PaymentStatus.REJECTED;

      // Casos en proceso
      case 'PROCESSING':
      case 'PROCESANDO':
      case 'IN_PROGRESS':
        return PaymentStatus.PROCESSING;

      // Casos pendientes
      case 'PENDING':
      case 'PENDIENTE':
      case 'WAITING':
      case 'CREATED':
        return PaymentStatus.PENDING;

      // Cancelaciones
      case 'CANCELLED':
      case 'CANCELED':
      case 'CANCELADA':
      case 'EXPIRED':
      case 'EXPIRADA':
        return PaymentStatus.CANCELLED;

      // Devoluciones
      case 'REFUNDED':
      case 'DEVUELTA':
      case 'REVERSED':
      case 'REVERSADA':
        return PaymentStatus.REFUNDED;

      default:
        return PaymentStatus.ERROR;
    }
  }
}
