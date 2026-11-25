# Reporte de Auditoría Técnica - Primera Etapa

**Proyecto**: Comercializadora Megamundo - Payment Checker  
**Fecha**: 19 de Septiembre de 2026  
**Tipo de Auditoría**: Estricta (Código fuente, Arquitectura, Base de Datos, Roles y Seguridad)  
**Regla de Ejecución**: Evaluación pura sin corrección silenciosa previa.

---

## Resumen Ejecutivo de Calificaciones

| # | Criterio Auditado | Calificación | Estado del Hallazgo |
| :-: | :--- | :---: | :--- |
| **1** | Placeholders y fidelidad en `BancolombiaPaymentProvider` | **PASS** | Todas las operaciones están protegidas con excepciones de especificación pendiente. |
| **2** | Ausencia de lógica inventada en `/api/webhooks/bancolombia` | **PASS** | El webhook delega al adaptador y devuelve 501 si está pendiente. El Mock está 100% aislado. |
| **3** | Aislamiento entre `MockPaymentProvider` y `BancolombiaPaymentProvider` | **PASS** | No comparten secretos, estado ni lógica de ejecución. |
| **4** | Frontend incapaz de forzar `status=APPROVED` en transacciones reales | **PASS** | No existe endpoint de mutación de estados bancarios. El cajero solo puede asociar ventas. |
| **5** | Restricción de `/api/dev/simulate-payment` a `NODE_ENV=development` | **FAIL** | **Falta guard de entorno**: el endpoint está activo incondicionalmente en la API. |
| **6** | Exclusión de `/dev/payments` en frontend de producción | **WARNING** | La ruta y el enlace en `Navbar` no están condicionados a `import.meta.env.DEV`. |
| **7** | Inmutabilidad de `rawPayload` en `PaymentEvent` | **PASS** | El payload crudo se persiste al inicio y el servicio nunca lo modifica en updates posteriores. |
| **8** | Constraint `UNIQUE` real en PostgreSQL para idempotencia | **PASS** | Verificado en motor: `"payment_events_provider_externalEventId_key" UNIQUE (provider, externalEventId)`. |
| **9** | Concurrencia: callbacks simultáneos con el mismo `externalEventId` | **PASS** | Imposible generar dos pagos por el constraint de DB. Se recomienda captura limpia de `P2002`. |
| **10** | Restricciones de roles `CASHIER` y `VIEWER` sobre pagos bancarios | **PASS** | Sin permisos ni endpoints para editar montos, cambiar estados o borrar transacciones. |
| **11** | No exposición de secretos en Git, frontend, logs y respuestas API | **FAIL** | **Falta `.gitignore`** en el repositorio. Frontend, logs y respuestas API están limpios. |
| **12** | Integridad de `BANCOLOMBIA.md` sin contratos ficticios | **PASS** | Documento inicia con `WAITING FOR OFFICIAL SANDBOX ACCESS` y solo solicita información faltante. |

---

## Hallazgos Detallados por Punto

### Punto 1: Placeholders en `BancolombiaPaymentProvider`
- **Calificación**: **PASS**
- **Evidencia**:
  En `packages/payment-core/src/bancolombia-provider.ts`:
  ```typescript
  export class BancolombiaSpecificationPendingError extends Error { ... }
  ```
  Los métodos `handleWebhook`, `createPaymentIntent`, `createQr`, `getPaymentStatus` y `reconcile` lanzan sistemáticamente `BancolombiaSpecificationPendingError`.
- **Conclusión**: No hay endpoints ficticios, formatos inventados ni llamadas mockeadas dentro de la clase Bancolombia.

---

### Punto 2: Inspección de `/api/webhooks/bancolombia`
- **Calificación**: **PASS**
- **Evidencia**:
  En `apps/api/src/routes/webhooks.ts`:
  El endpoint captura el cuerpo crudo (`rawBody`) y delega de inmediato a:
  ```typescript
  await paymentService.processWebhook('BANCOLOMBIA', { rawBody, headers, query });
  ```
  Al fallar porque el contrato oficial no ha sido suministrado, responde HTTP `501 Not Implemented` con `status: 'PENDING_OFFICIAL_INTEGRATION'`.
  La simulación de firma (`x-mock-simulate-invalid-signature`) se encuentra únicamente en `MockPaymentProvider`.

---

### Punto 3: Aislamiento entre Proveedores (Mock vs Bancolombia)
- **Calificación**: **PASS**
- **Evidencia**:
  `MockPaymentProvider` y `BancolombiaPaymentProvider` son clases independientes registradas en `PaymentProviderRegistry`. Ninguno comparte estado en memoria, certificados ni lógica de derivación de claves.

---

### Punto 4: Imposibilidad de forzar `APPROVED` desde Frontend
- **Calificación**: **PASS**
- **Evidencia**:
  En `apps/api/src/routes/payments.ts`:
  - `GET /api/payments` (lectura).
  - `GET /api/payments/:id` (lectura).
  - `POST /api/payments/:id/associate-sale` (único endpoint POST, solo recibe `saleNumber` y actualiza únicamente `saleId`).
  No existe ninguna ruta que admita `{ status: 'APPROVED' }` desde el cliente web. La única vía para registrar un pago es a través del procesador de webhooks autenticado.

---

### Punto 5: Bloqueo de `/api/dev/simulate-payment` en Producción
- **Calificación**: **FAIL**
- **Hallazgo**:
  En `apps/api/src/routes/dev.ts` y `apps/api/src/app.ts`:
  El plugin `devRoutes` se registra sin evaluar si `process.env.NODE_ENV === 'production'`.
  ```typescript
  // apps/api/src/app.ts línea 60:
  app.register(devRoutes); // Se monta siempre
  ```
- **Riesgo**: Si la API se levanta con `NODE_ENV=production`, el endpoint `/api/dev/simulate-payment` permanecería accesible y podría ser invocado externamente si no se bloquea.
- **Acción requerida**: Condicionar el registro de `devRoutes` en `app.ts` o agregar un guard `reply.status(404)` si `NODE_ENV === 'production'`.

---

### Punto 6: Exclusión de `/dev/payments` en el Frontend de Producción
- **Calificación**: **WARNING**
- **Hallazgo**:
  - En `apps/web/src/App.tsx`:
    ```tsx
    <Route path="/dev/payments" element={<ProtectedLayout><SimulatorView /></ProtectedLayout>} />
    ```
  - En `apps/web/src/components/Navbar.tsx`:
    El botón "Simulador Dev" siempre se renderiza en el menú.
- **Riesgo**: Al compilar con `npm run build`, la vista se incluye en los bundles de producción y la URL es accesible.
- **Acción requerida**: Condicionar la ruta y el botón del menú a `import.meta.env.DEV`.

---

### Punto 7: Inmutabilidad del `rawPayload` en `PaymentEvent`
- **Calificación**: **PASS**
- **Evidencia**:
  En `apps/api/src/services/payment.service.ts`:
  `rawPayload` se almacena durante `prisma.paymentEvent.create`.
  En la posterior actualización (`prisma.paymentEvent.update`), únicamente se modifican `paymentId`, `processingStatus` y `processedAt`.
  No hay endpoints públicos ni privados para mutar ni borrar eventos.

---

### Punto 8: Verificación de `UNIQUE constraint` en PostgreSQL
- **Calificación**: **PASS**
- **Evidencia**:
  Consulta directa al catálogo de PostgreSQL en `megamundo_payments`:
  ```sql
  Indexes:
      "payment_events_provider_externalEventId_key" UNIQUE, btree (provider, "externalEventId")
  ```
  La idempotencia está respaldada por una restricción de clave única física a nivel de base de datos relacional.

---

### Punto 9: Concurrencia y Carrera en Callbacks Simultáneos
- **Calificación**: **PASS** (con recomendación técnica)
- **Evidencia**:
  Si dos peticiones webhook con el mismo `(provider, externalEventId)` llegan en el mismo milisegundo:
  1. Ambas superan la consulta previa `findUnique`.
  2. La primera transacción inserta en `payment_events`.
  3. La segunda transacción es rechazada de inmediato por PostgreSQL con error de violación de clave única (`P2002`).
  4. Dado que el evento no se crea, el flujo se detiene antes de llegar a `prisma.payment.create`.
  - **Garantía**: Es técnicamente imposible que se creen dos registros `Payment`.
  - **Recomendación**: Capturar explícitamente el código `P2002` de Prisma en `PaymentService` para que el segundo request responda HTTP 200 con `{ received: true, duplicate: true }` en lugar de una excepción no controlada.

---

### Punto 10: Permisos de Roles `CASHIER` y `VIEWER`
- **Calificación**: **PASS**
- **Evidencia**:
  - No existen endpoints para eliminar pagos (`DELETE /api/payments`).
  - No existen endpoints para alterar el monto (`amount`), la referencia o el estado.
  - La única acción permitida para `CASHIER` es `associate-sale`.
  - El rol `VIEWER` tiene acceso denegado (`403 Forbidden`) en `associate-sale`.

---

### Punto 11: Gestión de Secretos en Git, Frontend, Logs y Respuestas
- **Calificación**: **FAIL** (en Git) / **PASS** (en Frontend, Logs y API)
- **Hallazgo Crítico**:
  - **Git (FAIL)**: **No existe el archivo `.gitignore`** en la raíz del proyecto. Si el usuario ejecuta `git init` o `git add .`, los archivos `.env` (con credenciales de base de datos y llaves JWT) serían versionados.
  - **Frontend (PASS)**: El cliente web no posee variables privadas ni secretos en su código ni en el bundle compilado.
  - **Logs (PASS)**: Fastify y AuditService están configurados para registrar únicamente identificadores, URLs, métodos y metadatos de negocio. No hay volcado de tokens ni contraseñas.
  - **Respuestas API (PASS)**: `passwordHash` se excluye explícitamente de las proyecciones de usuario.

---

### Punto 12: Integridad de `docs/BANCOLOMBIA.md`
- **Calificación**: **PASS**
- **Evidencia**:
  El documento inicia textualmente con:
  ```
  STATUS: WAITING FOR OFFICIAL SANDBOX ACCESS
  ```
  No inventa endpoints, nombres de campos, cabeceras, ni tokens. Contiene únicamente una matriz de requerimientos oficiales pendientes por solicitar a la entidad bancaria.

---

## Resumen de Acciones Correctivas Pendientes

Antes de pasar a la Segunda Etapa, se deben abordar los siguientes 3 puntos identificados:
1. **Crear `.gitignore`** protegiendo `.env`, `node_modules/` y artefactos de build.
2. **Proteger `/api/dev/simulate-payment`** en el backend para que responda 404/desactivado cuando `config.env === 'production'`.
3. **Proteger `/dev/payments`** en el frontend usando `import.meta.env.DEV` para ocultar la ruta y el botón del menú en builds de producción.
