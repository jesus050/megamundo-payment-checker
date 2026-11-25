# Checklist de Preparación para Producción (Production Readiness)
## Megamundo Payment Checker
**Fecha de Verificación**: Septiembre 2026  
**Estado**: **LISTO PARA DESPLIEGUE (SECURITY HARDENING COMPLETADO)**

---

## Fase 1: Bloqueo Estricto de Herramientas de Desarrollo
- [x] **Desactivación de Rutas Dev**: `POST /api/dev/simulate-payment` no es registrado en Fastify cuando `NODE_ENV=production` y responde 404 estricto. *(Verificado en `dev-isolation.test.ts`)*
- [x] **Bloqueo de Mock Provider**: `MockPaymentProvider` bloqueado en registro, arroja excepción al ejecutarse en prod y `PaymentService` rechaza llamadas a `MOCK`. *(Verificado en `dev-isolation.test.ts`)*
- [x] **Ocultamiento de Vistas Dev en Frontend**: En producción y fuera de `localhost`, el botón y menú de simulación de pagos dev permanecen ocultos.

---

## Fase 2: Configuración Segura de Entorno y Secretos
- [x] **Validación Zod al Inicio**: Esquema Zod en `config.ts` valida al arranque y detiene la aplicación si falta `DATABASE_URL`, `APP_SECRET` o `ALLOWED_ORIGINS`. *(Verificado en `env-validation.test.ts`)*
- [x] **Calidad Criptográfica de `APP_SECRET`**:
  - Exige al menos 32 caracteres y bloquea claves inseguras por defecto en producción. *(Verificado en `env-validation.test.ts`)*
- [x] **Bancolombia Feature Flag**:
  - `BANCOLOMBIA_INTEGRATION_ENABLED=false` por defecto, respondiendo 503 Service Unavailable sin contratos ficticios. *(Verificado en `env-validation.test.ts`)*
- [x] **Sin Secretos en Control de Versiones**:
  - `.env` ignorado en `.gitignore`. Variables documentadas en `.env.example`.

---

## Fase 3: Seguridad de Red y Cabeceras
- [x] **CORS Restringido**:
  - Lista blanca estricta `ALLOWED_ORIGINS`. Rechaza orígenes no autorizados y prohíbe comodín `*` en producción. *(Verificado en `security-perimeter.test.ts`)*
- [x] **Security Headers (Helmet & CSP)**:
  - `@fastify/helmet` activo con Content-Security-Policy (CSP) estricto: `connect-src 'self'` para SSE y `frame-ancestors 'none'` anti-clickjacking. *(Verificado en `security-perimeter.test.ts`)*
- [x] **Rate Limiting**:
  - `@fastify/rate-limit` activo: login (5 req/min), pagos (60 req/min), webhooks (120 req/min). Responde 429 Too Many Requests cuando se excede la cuota. *(Verificado en `security-perimeter.test.ts`)*

---

## Fase 4: Autenticación, SSE y Multi-Tenancy
- [x] **Autenticación en Stream SSE**:
  - `/api/realtime/stream` requiere token JWT válido (`Authorization: Bearer` o `?token=`). Peticiones no autenticadas devuelven HTTP 401. *(Verificado en `multi-tenancy.test.ts`)*
- [x] **Aislamiento de Negocios (Tenant Isolation)**:
  - Cada cliente SSE se vincula a su `businessId`. `broadcast` entrega eventos exclusivamente a clientes del mismo comercio.
  - Endpoints de pagos y auditoría filtran obligatoriamente por el `businessId` del token JWT. *(Verificado en `multi-tenancy.test.ts`)*

---

## Fase 5: Concurrencia e Idempotencia en Base de Datos
- [x] **Manejo Seguro de Constraint Violations**:
  - Manejo de colisiones en base de datos mediante captura de excepción `P2002` de Prisma.
  - Probada concurrencia masiva (100 peticiones simultáneas) garantizando 1 procesada, 99 duplicados y 0 errores 500. *(Verificado en `concurrency.test.ts`)*
- [x] **Inmutabilidad de Eventos**:
  - `PaymentEvent` y `AuditLog` inmutables sin endpoints REST para mutación o borrado.

---

## Fase 6: Infraestructura y Servidor Reverso (Checklist de Despliegue en Servidor)
- [ ] **Terminación TLS / HTTPS**:
  - Configurar Nginx o Caddy con certificado SSL/TLS (Let's Encrypt / Cloudflare).
- [ ] **Base de Datos PostgreSQL de Producción**:
  - Configurar `DATABASE_URL` con usuario de privilegios mínimos y `sslmode=require`.
  - Configurar backup diario automatizado (`pg_dump`).

---

## Fase 7: Pruebas Automatizadas de Seguridad
- [x] **Suite de Pruebas de Regresión y Seguridad**:
  - 32 pruebas automatizadas ejecutadas y aprobadas (100% pasando).
  - Incluye los 12 tests de escenarios de pagos y resiliencia previos intactos.
  - Compilación `npm run build` limpia en todos los workspaces.
