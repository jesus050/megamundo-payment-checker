import { FastifyInstance } from 'fastify';
import { prisma } from '@megamundo/database';
import { RealtimeService } from '../services/realtime.service';

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/api/health', async (_request, reply) => {
    let databaseStatus = 'unknown';

    try {
      // Chequeo ligero de base de datos sin sobrecargar ni transacciones ficticias
      await prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'connected';
    } catch (error) {
      databaseStatus = 'disconnected';
    }

    const realtime = RealtimeService.getInstance();
    const realtimeConnections = realtime.getConnectedClientsCount();

    const isHealthy = databaseStatus === 'connected';

    return reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        api: {
          status: 'ok',
          uptime: process.uptime(),
          version: '1.0.0',
        },
        database: {
          status: databaseStatus,
          provider: 'PostgreSQL',
        },
        realtime: {
          status: 'ok',
          type: 'Server-Sent Events (SSE)',
          activeConnections: realtimeConnections,
        },
      },
    });
  });
}
