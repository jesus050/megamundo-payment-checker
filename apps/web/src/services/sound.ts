/**
 * Generador de sonido de confirmación de pago utilizando Web Audio API nativo.
 * No requiere descargar archivos de audio externos y funciona instantáneamente.
 */
class SoundService {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    // Cargar preferencia guardada en localStorage
    const saved = localStorage.getItem('megamundo_sound_enabled');
    if (saved !== null) {
      this.soundEnabled = saved === 'true';
    }
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public setEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    localStorage.setItem('megamundo_sound_enabled', enabled ? 'true' : 'false');
  }

  public toggle(): boolean {
    this.setEnabled(!this.soundEnabled);
    return this.soundEnabled;
  }

  /**
   * Reproduce un acorde armónico brillante y satisfactorio de pago exitoso (C6 - G6 - C7)
   */
  public playPaymentConfirmed(): void {
    if (!this.soundEnabled) return;

    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // Frecuencias para un timbre de confirmación elegante
      const notes = [
        { freq: 523.25, time: 0, duration: 0.25 },     // C5
        { freq: 659.25, time: 0.08, duration: 0.35 },  // E5
        { freq: 783.99, time: 0.16, duration: 0.45 },  // G5
        { freq: 1046.5, time: 0.24, duration: 0.7 },   // C6
      ];

      notes.forEach(({ freq, time, duration }) => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + time);

        // Curva de volumen suave (ataque rápido y decaimiento exponencial)
        gain.gain.setValueAtTime(0.001, now + time);
        gain.gain.exponentialRampToValueAtTime(0.2, now + time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now + time);
        osc.stop(now + time + duration);
      });
    } catch (e) {
      console.warn('Web Audio no disponible:', e);
    }
  }
}

export const soundService = new SoundService();
