# Integración de Notificaciones Bancolombia vía Zernio (SMS / Email)

## 1. Propósito
Permite la **validación automática e instantánea de pagos de Bancolombia** en Megamundo sin requerir la aprobación o suscripción de APIs oficiales de Bancolombia. 

Funciona capturando las notificaciones legítimas que el banco envía al titular (vía mensajes de texto SMS o correos electrónicos) y redirigiéndolas mediante un webhook de **Zernio** a nuestra aplicación.

---

## 2. Flujo Operativo

```
[Cliente paga con QR/Transferencia Bancolombia]
                       │
                       ▼
    [Bancolombia genera notificación SMS / Email]
                       │
                       ▼
       [Dispositivo / Bandeja conectada a Zernio]
                       │
                       ▼
   [Webhook Zernio POST /api/webhooks/zernio]
                       │
                       ▼
   [ZernioNotificationProvider: Parser & HMAC SHA-256]
                       │
                       ▼
   [PaymentService: Idempotencia & Registro de Pago]
                       │
                       ▼
   [SSE Event: payment.created -> Terminal de Caja en Vivo]
```

1. **Recepción en Zernio**: Zernio captura el SMS entrante en el teléfono del comercio o el correo electrónico de alerta de Bancolombia.
2. **Envío Webhook**: Zernio emite un `POST` al endpoint `/api/webhooks/zernio`.
3. **Parseo y Extracción**: `ZernioNotificationProvider` analiza el texto crudo y extrae:
   - **Monto entero en COP** (ej. `$185.000` $\rightarrow$ `185000`).
   - **Número de Comprobante / Autorización** (identificador único del pago).
   - **Referencia del Comercio** (si el cliente o QR incluyó `MM-1058` o similar).
   - **Últimos 4 dígitos de la cuenta** destino (ej. `*5027`).
4. **Validación de Firma**: Si se configuró `ZERNIO_WEBHOOK_SECRET`, se valida la firma HMAC SHA-256 en la cabecera `X-Zernio-Signature`.
5. **Idempotencia**: Se garantiza unicidad con el par `(ZERNIO, ZER-<comprobante>)`. Notificaciones duplicadas o repetidas son ignoradas limpiamente sin duplicar saldos.
6. **Tiempo Real**: El evento se difunde de inmediato por Server-Sent Events (SSE) a la terminal de punto de venta `/terminal`, aprobando la transacción en pantalla sin refrescar la página.

---

## 3. Configuración de Variables de Entorno

En el archivo `.env`:

```env
# Habilitación de la integración Zernio (true / false)
ZERNIO_INTEGRATION_ENABLED=true

# Clave secreta compartida con Zernio para validación HMAC (opcional pero altamente recomendado en producción)
ZERNIO_WEBHOOK_SECRET=tu_secreto_seguro_aqui
```

---

## 4. Configuración del Webhook en Zernio

- **URL del Webhook**: `https://<tu-dominio-o-ngrok>/api/webhooks/zernio`
- **Método HTTP**: `POST`
- **Cabeceras**:
  - `Content-Type: application/json`
  - `X-Zernio-Signature: <firma_hmac_hex>` (si se configuró secret)
- **Eventos soportados**:
  - `message.received` (para SMS)
  - `email.received` (para correos)

### Estructura de Payload SMS:
```json
{
  "event": "message.received",
  "id": "evt-123456",
  "data": {
    "from": "85555",
    "body": "Bancolombia: Le informamos transferencia por $185.000 de cta 1234 a cta *5027. Comprobante 987654. Ref MM-1058"
  }
}
```

### Estructura de Payload Email:
```json
{
  "event": "email.received",
  "id": "evt-789012",
  "data": {
    "from": "notificaciones@bancolombia.com.co",
    "subject": "Transferencia recibida en su cuenta Bancolombia",
    "body": "Estimado cliente, ha recibido un pago de $500.000 con destino a la cuenta *5027. Autorización 554433. Referencia MM-2001."
  }
}
```

---

## 5. Pruebas y Verificación

La suite de tests unitarios y de integración cubre:
1. Parseo de SMS estándar de Bancolombia.
2. Parseo de emails de transferencia/QR.
3. Rechazo de firmas HMAC inválidas.
4. Deshabilitación mediante `ZERNIO_INTEGRATION_ENABLED=false` (retorna HTTP 503).
5. Procesamiento end-to-end con vinculación de venta e idempotencia.

Ejecutar:
```bash
npm run test
```
