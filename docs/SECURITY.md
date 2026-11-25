# Políticas de Seguridad: Megamundo Payment Checker

## 1. Principios de Seguridad Bancaria y Anti-Fraude

Para proteger los activos de Comercializadora Megamundo y mantener estricta conformidad con las normas bancarias:

### Prácticas Terminantemente Prohibidas (Por Diseño del Sistema):
- ❌ **Cero Scraping**: No se realizan scraping ni automatizaciones sobre la sucursal virtual.
- ❌ **Cero Almacenamiento de Credenciales Bancarias**: Nunca se solicitan ni almacenan usuarios bancarios, contraseñas ni claves dinámicas.
- ❌ **Cero Lectura de SMS o Correos**: El sistema no lee mensajes de texto personales de empleados.
- ❌ **Cero Validación por Capturas de Pantalla u OCR**: Un empleado nunca puede marcar una transacción bancaria como confirmada por el simple hecho de que un cliente muestre un comprobante gráfico en su celular.

### Fuente de Verdad Invariable:
- La **única** fuente de verdad es la notificación servidor a servidor autenticada criptográficamente enviada por el proveedor de pagos.

---

## 2. Seguridad del Webhook / Callback

1. **Verificación Criptográfica Obligatoria**:
   - Nunca se confía únicamente en la dirección IP de origen (suceptible a spoofing).
   - Toda notificación debe estar firmada (JWT/JWS o HMAC) y validada contra la clave pública del banco.
   - Peticiones con firma alterada o ausente son rechazadas de inmediato y registradas en `AuditLog` con la acción `INVALID_WEBHOOK_SIGNATURE`.

2. **Inyección Inmune y Rechazo de Payloads Frontend**:
   - El endpoint `/api/webhooks/bancolombia` no acepta órdenes de aprobación enviadas directamente desde el navegador de un cliente.
   - En producción, `/api/dev/simulate-payment` queda estrictamente deshabilitado (`NODE_ENV=production`).

3. **Respuesta Rápida Desacoplada**:
   - Para cumplir con los SLAs bancarios (< 200ms) y evitar ataques de agotamiento de recursos (*resource exhaustion*), el endpoint registra el `PaymentEvent`, responde `HTTP 200/202` y procesa las emisiones en milisegundos.

---

## 3. Control de Acceso Basado en Roles (RBAC)

| Rol | Permisos | Prohibiciones Estrictas |
| :--- | :--- | :--- |
| **`ADMIN`** | Consultar todas las transacciones, cuentas de pago, logs de auditoría, configuraciones del sistema y usuarios | No puede alterar montos recibidos por el banco |
| **`CASHIER`** | Consultar últimos pagos, buscar por valor/referencia, verificar confirmación y asociar manualmente un pago huérfano a un número de venta | **NO puede** alterar montos, no puede cambiar un pago `APPROVED` por `REJECTED`, no puede inventar transacciones ni editar payloads |
| **`VIEWER`** | Consulta de solo lectura para auditoría o contabilidad | No puede modificar ninguna entidad |

---

## 4. Inmutabilidad y Auditoría

- Toda acción relevante genera un registro en `AuditLog` (quién, qué acción, cuándo, entidad e ID).
- Los pagos bancarios (`Payment`) y eventos crudos (`PaymentEvent`) tienen prohibido el borrado físico (`DROP/DELETE`).
- Los logs estructurados omiten intencionalmente contraseñas, secretos, tokens completos y datos sensibles.
