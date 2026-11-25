import { PaymentProvider } from './types';
import { MockPaymentProvider } from './mock-provider';
import { BancolombiaPaymentProvider } from './bancolombia-provider';
import { ZernioNotificationProvider } from './zernio-provider';
import { PaymentProviderNameType } from '@megamundo/shared';

export class PaymentProviderRegistry {
  private static instance: PaymentProviderRegistry;
  private providers: Map<string, PaymentProvider> = new Map();

  private constructor() {
    // Solo registrar MockPaymentProvider en entornos distintos a producción
    if (process.env.NODE_ENV !== 'production') {
      this.register(new MockPaymentProvider());
    }
    this.register(new BancolombiaPaymentProvider());
    this.register(new ZernioNotificationProvider());
  }

  public static getInstance(): PaymentProviderRegistry {
    if (!PaymentProviderRegistry.instance) {
      PaymentProviderRegistry.instance = new PaymentProviderRegistry();
    }
    return PaymentProviderRegistry.instance;
  }

  public register(provider: PaymentProvider): void {
    if (provider.name.toUpperCase() === 'MOCK' && process.env.NODE_ENV === 'production') {
      throw new Error('No está permitido registrar MockPaymentProvider en entornos de producción.');
    }
    this.providers.set(provider.name.toUpperCase(), provider);
  }

  public get(name: string | PaymentProviderNameType): PaymentProvider {
    const provider = this.providers.get(name.toUpperCase());
    if (!provider) {
      throw new Error(
        `Proveedor de pago '${name}' no está registrado en el sistema. Proveedores disponibles: ${Array.from(
          this.providers.keys()
        ).join(', ')}`
      );
    }
    return provider;
  }

  public has(name: string): boolean {
    return this.providers.has(name.toUpperCase());
  }

  public listRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
