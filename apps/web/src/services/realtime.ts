export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

type PaymentCallback = (data: any) => void;
type StatusCallback = (status: ConnectionStatus) => void;

class RealtimeClient {
  private eventSource: EventSource | null = null;
  private status: ConnectionStatus = 'disconnected';
  private paymentCreatedListeners: Set<PaymentCallback> = new Set();
  private paymentUpdatedListeners: Set<PaymentCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  private reconnectTimer: any = null;

  public connect(): void {
    if (this.eventSource && (this.status === 'connected' || this.status === 'connecting')) {
      return;
    }

    this.setStatus('connecting');

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('megamundo_token') : null;
      const url = token ? `/api/realtime/stream?token=${encodeURIComponent(token)}` : '/api/realtime/stream';
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.setStatus('connected');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.eventSource.addEventListener('connected', (_e) => {
        this.setStatus('connected');
      });

      this.eventSource.addEventListener('payment.created', (e) => {
        try {
          const payload = JSON.parse(e.data);
          this.paymentCreatedListeners.forEach((cb) => cb(payload));
        } catch (err) {
          console.error('Error al procesar evento payment.created:', err);
        }
      });

      this.eventSource.addEventListener('payment.updated', (e) => {
        try {
          const payload = JSON.parse(e.data);
          this.paymentUpdatedListeners.forEach((cb) => cb(payload));
        } catch (err) {
          console.error('Error al procesar evento payment.updated:', err);
        }
      });

      this.eventSource.addEventListener('heartbeat', (_e) => {
        // Heartbeat recibido para verificar que el socket sigue vivo
        if (this.status !== 'connected') {
          this.setStatus('connected');
        }
      });

      this.eventSource.onerror = () => {
        this.setStatus('disconnected');
        this.cleanup();
        this.scheduleReconnect();
      };
    } catch (err) {
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((cb) => cb(this.status));
    }
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public onPaymentCreated(callback: PaymentCallback): () => void {
    this.paymentCreatedListeners.add(callback);
    return () => this.paymentCreatedListeners.delete(callback);
  }

  public onPaymentUpdated(callback: PaymentCallback): () => void {
    this.paymentUpdatedListeners.add(callback);
    return () => this.paymentUpdatedListeners.delete(callback);
  }

  public onStatusChange(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  private scheduleReconnect(): void {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, 3000);
    }
  }

  public disconnect(): void {
    this.cleanup();
    this.setStatus('disconnected');
  }

  private cleanup(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

export const realtimeClient = new RealtimeClient();
