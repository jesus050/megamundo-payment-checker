import { FastifyInstance } from 'fastify';
import { RealtimeService } from '../services/realtime.service';
import * as crypto from 'crypto';

export default async function realtimeRoutes(fastify: FastifyInstance) {
  const realtimeService = RealtimeService.getInstance();

  /**
   * Canal Server-Sent Events (SSE) para actualizaciones en vivo de pagos
   * Exige autenticación estricta y aislamiento por businessId.
   */
  fastify.get('/api/realtime/stream', async (request, reply) => {
    let token: string | undefined;
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if ((request.query as any)?.token) {
      token = (request.query as any).token;
    }

    if (!token) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Se requiere token de autenticación para el canal en tiempo real',
      });
    }

    let payload: any;
    try {
      payload = fastify.jwt.verify(token);
    } catch {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Token inválido o expirado para streaming en tiempo real',
      });
    }

    const businessId = payload.businessId;
    if (!businessId) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Usuario sin empresa asociada (businessId ausente)',
      });
    }

    const clientId = crypto.randomUUID();

    // Configurar cabeceras obligatorias para SSE
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    realtimeService.addClient(clientId, reply, businessId);

    // Detectar desconexión del cliente
    request.raw.on('close', () => {
      realtimeService.removeClient(clientId);
    });
  });
}
