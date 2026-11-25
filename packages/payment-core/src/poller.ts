import {
  PaymentVerificationEvaluation,
} from './types';

export interface PollerSchedule {
  /** Duración de la fase inicial (por defecto 30.000 ms = 30s) */
  initialPhaseThresholdMs?: number;
  /** Intervalo durante la fase inicial (por defecto 2.000 ms = cada 2s) */
  initialIntervalMs?: number;
  /** Duración acumulada de la fase intermedia (por defecto 90.000 ms = 90s) */
  middlePhaseThresholdMs?: number;
  /** Intervalo durante la fase intermedia (por defecto 5.000 ms = cada 5s) */
  middleIntervalMs?: number;
  /** Intervalo para la fase posterior (por defecto 10.000 ms = cada 10s) */
  lateIntervalMs?: number;
  /** Tiempo límite total de sondeo (por defecto 300.000 ms = 5 minutos) */
  totalTimeoutMs?: number;
}

export interface PollerResult {
  success: boolean;
  timeout: boolean;
  attempts: number;
  totalElapsedMs: number;
  lastEvaluation?: PaymentVerificationEvaluation;
}

/**
 * Servicio conceptual de sondeo (Poller) para verificación de pagos QR.
 *
 * NOTA DE ARQUITECTURA CRÍTICA:
 * Los intervalos y timeouts configurados aquí son políticas internas de Megamundo,
 * NO son requisitos ni especificaciones impuestas por Bancolombia.
 * No forman parte del contrato técnico del proveedor.
 */
export class PaymentVerificationPoller {
  private readonly schedule: Required<PollerSchedule>;

  constructor(schedule: PollerSchedule = {}) {
    this.schedule = {
      initialPhaseThresholdMs: schedule.initialPhaseThresholdMs ?? 30_000,
      initialIntervalMs: schedule.initialIntervalMs ?? 2_000,
      middlePhaseThresholdMs: schedule.middlePhaseThresholdMs ?? 90_000,
      middleIntervalMs: schedule.middleIntervalMs ?? 5_000,
      lateIntervalMs: schedule.lateIntervalMs ?? 10_000,
      totalTimeoutMs: schedule.totalTimeoutMs ?? 300_000,
    };
  }

  /**
   * Calcula el siguiente intervalo en función del tiempo transcurrido (backoff razonable)
   */
  getNextInterval(elapsedMs: number): number {
    if (elapsedMs < this.schedule.initialPhaseThresholdMs) {
      return this.schedule.initialIntervalMs;
    }
    if (elapsedMs < this.schedule.middlePhaseThresholdMs) {
      return this.schedule.middleIntervalMs;
    }
    return this.schedule.lateIntervalMs;
  }

  /**
   * Ejecuta el ciclo de sondeo contra el evaluador del proveedor:
   * 1. Inicia cuando existe un cobro QR pendiente.
   * 2. Consulta el estado.
   * 3. Se detiene INMEDIATAMENTE cuando se obtiene 'approved' / confirmado.
   * 4. Se detiene si se alcanza el timeout total.
   */
  async poll(
    queryFn: () => Promise<PaymentVerificationEvaluation>,
    sleepFn: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  ): Promise<PollerResult> {
    let elapsedMs = 0;
    let attempts = 0;

    while (elapsedMs <= this.schedule.totalTimeoutMs) {
      attempts++;
      const evaluation = await queryFn();

      // 3. Detenerse inmediatamente cuando transactionStatus == approved
      if (evaluation.confirmed && evaluation.status === 'APPROVED') {
        return {
          success: true,
          timeout: false,
          attempts,
          totalElapsedMs: elapsedMs,
          lastEvaluation: evaluation,
        };
      }

      const nextInterval = this.getNextInterval(elapsedMs);

      if (elapsedMs + nextInterval > this.schedule.totalTimeoutMs) {
        break;
      }

      await sleepFn(nextInterval);
      elapsedMs += nextInterval;
    }

    // 4. Termina al llegar al timeout
    return {
      success: false,
      timeout: true,
      attempts,
      totalElapsedMs: elapsedMs,
    };
  }
}
