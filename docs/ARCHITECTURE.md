# Arquitectura del Sistema: Megamundo Payment Checker

## 1. Visión General

El sistema **Megamundo Payment Checker** es una plataforma desacoplada y de alta disponibilidad construida para la verificación y confirmación inmediata de pagos en punto de venta físico mediante Códigos QR de Bancolombia (u otros proveedores futuros), sin depender de capturas de pantalla, SMS o consultas manuales en cuentas bancarias.

```
CLIENTE (Caja física)
       ↓  Escanea QR
BANCOLOMBIA
       ↓  Notificación Servidor a Servidor (Callback / Webhook)
API MEGAMUNDO (Fastify)
       ↓  1. Captura rawPayload
       ↓  2. Validación de Firma Criptográfica
       ↓  3. Chequeo de Idempotencia (provider + externalEventId)
       ↓  4. Registro en Base de Datos (PaymentEvent + Payment)
       ↓  5. Respuesta HTTP inmediata al banco (< 200ms)
       ↓  6. Emisión Server-Sent Events (SSE)
PANEL DE CAJA EN TIEMPO REAL (/terminal)
       ↓  Alerta visual + Sonido de caja (Web Audio API)
PAGO CONFIRMADO INEQUÍVOCO (2-3 segundos)
```

---

## 2. Organización Monorepo

El repositorio utiliza **npm workspaces** estructurado de la siguiente forma:

```
megamundo-payment-checker/
  ├── apps/
  │   ├── api/                    # Servidor REST + SSE Fastify (TypeScript)
  │   │   ├── src/
  │   │   │   ├── plugins/        # JWT y RBAC
  │   │   │   ├── routes/         # Health, Auth, Webhooks, Payments, Dev, SSE, Audit
  │   │   │   ├── services/       # PaymentService, RealtimeService, AuditService
  │   │   │   ├── app.ts          # Factory de la aplicación Fastify
  │   │   │   └── server.ts       # Entrypoint del servidor
  │   │   └── test/               # Pruebas automatizadas (12 escenarios)
  │   │
  │   └── web/                    # Frontend React 18 + Vite + Tailwind CSS + PWA
  │       ├── src/
  │       │   ├── components/     # Navbar, PaymentRow, Modales, Indicadores
  │       │   ├── context/        # AuthContext (roles ADMIN, CASHIER, VIEWER)
  │       │   ├── services/       # api.ts, sound.ts (Web Audio), realtime.ts (SSE)
  │       │   └── views/          # DashboardView (/), TerminalView (/terminal), SimulatorView (/dev/payments)
  │       └── public/             # Manifest PWA y recursos
  │
  ├── packages/
  │   ├── database/               # Prisma ORM, PostgreSQL schema y Seed
  │   ├── payment-core/           # Abstracción multiproveedor (PaymentProvider, Mock, Bancolombia)
  │   └── shared/                 # Tipos TypeScript, Enums canónicos, Zod schemas y formateadores COP
  │
  └── docs/                       # Documentación técnica y guías operativas
```

---

## 3. Modelo Multiproveedor

La aplicación nunca se acopla directamente a los tipos o contratos de Bancolombia. Se define la interfaz agnóstica `PaymentProvider`:

```typescript
export interface PaymentProvider {
  readonly name: PaymentProviderNameType;
  handleWebhook(request: WebhookRequest): Promise<WebhookResult>;
  createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  createQr(input: CreateQrInput): Promise<QrResult>;
  getPaymentStatus(providerPaymentId: string): Promise<PaymentStatusResult>;
  reconcile(input: ReconcileInput): Promise<ReconcileResult>;
}
```

### Implementaciones:
1. **`MockPaymentProvider`**: Emula el comportamiento del banco en desarrollo, validación de firmas, pruebas de idempotencia y soporte para pruebas extremas de concurrencia.
2. **`BancolombiaPaymentProvider`**: Adaptador preparado con puntos de enganche documentados para cuando se entregue la documentación oficial de Sandbox.
3. **Proveedores futuros preparados**: Wompi, Bold, Nequi, MercadoPago.

---

## 4. Tiempo Real: Server-Sent Events (SSE)

Para el MVP se seleccionó **Server-Sent Events (SSE)** frente a WebSockets por las siguientes razones:
- **Unidireccional y liviano**: Las cajas solo necesitan recibir notificaciones de pagos confirmados en milisegundos.
- **Reconexión nativa del navegador**: `EventSource` gestiona de forma transparente cortes temporales de red en el mostrador.
- **Transparencia HTTP**: Funciona sin configuraciones complejas de upgrades de protocolo sobre proxies inversos (NGINX, Cloudflare, Traefik).
- **Heartbeats periódicos**: El servidor emite un pulso cada 15 segundos para asegurar la vitalidad del enlace.
