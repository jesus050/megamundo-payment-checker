import { FastifyReply } from 'fastify';

interface SSEClient {
  id: string;
  reply: FastifyReply;
  businessId: string;
  connectedAt: Date;
}

export class RealtimeService {
  private static instance: RealtimeService;
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.startHeartbeat();
  }

  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  public addClient(id: string, reply: FastifyReply, businessId = 'default'): void {
    this.clients.set(id, {
      id,
      reply,
      businessId,
      connectedAt: new Date(),
    });

    // Enviar evento inicial de conexión exitosa
    this.sendToClient(reply, 'connected', {
      clientId: id,
      businessId,
      timestamp: new Date().toISOString(),
      message: 'Conectado al canal en tiempo real de Megamundo',
    });
  }

  public removeClient(id: string): void {
    this.clients.delete(id);
  }

  public getConnectedClientsCount(businessId?: string): number {
    if (!businessId) return this.clients.size;
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.businessId === businessId) count++;
    }
    return count;
  }

  public broadcast(eventName: string, data: any, targetBusinessId?: string): void {
    const businessId = targetBusinessId || data?.payment?.businessId || data?.businessId;
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;

    for (const [id, client] of this.clients.entries()) {
      // Filtrar por businessId: nunca emitir pagos a clientes de otro comercio
      if (businessId && client.businessId !== businessId) {
        continue;
      }

      try {
        client.reply.raw.write(payload);
      } catch (err) {
        // Si el socket está cerrado, retirar cliente
        this.clients.delete(id);
      }
    }
  }

  private sendToClient(reply: FastifyReply, eventName: string, data: any): void {
    try {
      reply.raw.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // Ignorar si el cliente ya cerró la conexión
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.broadcast('heartbeat', {
        timestamp: new Date().toISOString(),
        clients: this.clients.size,
      });
    }, 15000); // Cada 15 segundos
  }

  public cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    this.clients.clear();
  }
}
