import { prisma } from '@megamundo/database';

export interface AuditLogParams {
  businessId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any> | string;
}

export class AuditService {
  private static instance: AuditService;

  public static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  /**
   * Registra una acción en el log de auditoría inmutable.
   * Nunca permite eliminar registros de auditoría.
   */
  async log(params: AuditLogParams): Promise<void> {
    try {
      const metadataString =
        typeof params.metadata === 'object'
          ? JSON.stringify(params.metadata)
          : params.metadata || null;

      await prisma.auditLog.create({
        data: {
          businessId: params.businessId,
          userId: params.userId || null,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          metadata: metadataString,
        },
      });
    } catch (error) {
      // Registrar en log estándar si la base de datos no está disponible momentáneamente
      console.error('[AUDIT_ERROR] No se pudo persistir el AuditLog:', {
        params,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  async getRecentLogs(businessId: string, limit = 50) {
    try {
      return await prisma.auditLog.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });
    } catch (error) {
      console.error('[AUDIT_QUERY_ERROR]', error);
      return [];
    }
  }
}
