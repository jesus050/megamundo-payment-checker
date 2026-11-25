# MEGAMUNDO PAYMENT CHECKER

> Sistema web moderno de alta confiabilidad para **Comercializadora Megamundo** diseñado para confirmar automáticamente los pagos recibidos mediante Código QR Bancolombia en caja física, sin depender de capturas de pantalla, SMS o consultas bancarias manuales.

---

## 🌟 Características Principales

- **Abstracción Multiproveedor**: `MockPaymentProvider` funcional para desarrollo y pruebas, y `BancolombiaPaymentProvider` desacoplado y preparado para conectar las credenciales oficiales de Sandbox sin inventar contratos ficticios.
- **Terminal de Caja (`/terminal`)**: Vista de alto contraste optimizada para mostrador físico que permite al cajero responder en **2-3 segundos** si el pago entró, con visualización destacada del último pago, búsqueda rápida por valor y actualización en vivo.
- **Notificaciones en Tiempo Real (SSE)**: Canal Server-Sent Events nativo que empuja las confirmaciones al instante con alerta sonora armónica (Web Audio API) y banner visual de pago aprobado.
- **Idempotencia Estricta**: Constraint único `(provider, externalEventId)` que previene duplicidad ante reintentos del banco.
- **Auditoría Inmutable (`AuditLog`)**: Registro estricto de todas las operaciones administrativas y de enlace con ventas de Nubixor.
- **Control de Acceso por Roles**: `ADMIN`, `CASHIER` y `VIEWER`.
- **Suite de Pruebas**: 12 escenarios de simulación y resiliencia automatizados con Vitest.

---

## 🏗️ Estructura del Monorepo

```
megamundo-payment-checker/
  ├── apps/
  │   ├── api/          # Servidor Fastify, REST, SSE, JWT y Webhooks
  │   └── web/          # React 18, Vite, Tailwind CSS, PWA, Terminal y Dashboard
  ├── packages/
  │   ├── database/     # Prisma ORM, esquema PostgreSQL y script de Seed
  │   ├── payment-core/ # Interfaz PaymentProvider, Mappers, Mock y Bancolombia
  │   └── shared/       # Tipos, Enums, Zod schemas y formato de moneda COP
  └── docs/             # Documentación técnica completa
```

---

## 🚀 Inicio Rápido

### 1. Variables de Entorno
```bash
cp .env.example .env
```

### 2. Instalación de Dependencias
```bash
npm install
```

### 3. Base de Datos
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 4. Iniciar en Desarrollo
```bash
npm run dev
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Terminal de Caja**: [http://localhost:5173/terminal](http://localhost:5173/terminal)
- **Simulador Dev**: [http://localhost:5173/dev/payments](http://localhost:5173/dev/payments)
- **API Backend**: [http://localhost:3001](http://localhost:3001)

### 5. Ejecutar Pruebas
```bash
npm run test
```

---

## 📚 Documentación Técnica Detallada

- [Arquitectura del Sistema](docs/ARCHITECTURE.md)
- [Ciclo de Vida de Pagos e Idempotencia](docs/PAYMENTS.md)
- [Integración Oficial Bancolombia (Esperando Sandbox)](docs/BANCOLOMBIA.md)
- [Políticas de Seguridad y Anti-Fraude](docs/SECURITY.md)
- [Guía de Despliegue y Puesta en Marcha](docs/DEPLOYMENT.md)
- [Guía de Pruebas Automatizadas y Simulaciones](docs/TESTING.md)
