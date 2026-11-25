import { FastifyInstance } from 'fastify';
import { AuditService } from '../services/audit.service';
import { UserRole } from '@megamundo/shared';

export default async function auditRoutes(fastify: FastifyInstance) {
  const auditService = AuditService.getInstance();

  /**
   * Consulta de registros inmutables de auditoría (Exclusivo para ADMIN)
   */
  fastify.get(
    '/api/audit-logs',
    {
      preHandler: [
        fastify.authenticate,
        fastify.authorize([UserRole.ADMIN]),
      ],
    },
    async (request, reply) => {
      const logs = await auditService.getRecentLogs(request.user.businessId, 100);
      return reply.send({ logs });
    }
  );
}
