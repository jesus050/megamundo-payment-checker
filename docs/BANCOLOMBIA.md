# Integración Oficial con Bancolombia

```yaml
APPLICATION: Megamundo Payment Checker Sandbox
INTEGRATION STATUS: DISABLED (BANCOLOMBIA_INTEGRATION_ENABLED=false)
PRODUCTS:
  1. QR Code 3.0.1 (QR Code - QR Management)
  2. QR Payments Information 2.0.0 (Qr Payments Information - Transactions)
QR_CALLBACK_STATUS: NEEDS_BANCOLOMBIA_CONFIRMATION
QR_PAYMENTS_AUTH_STATUS: WAITING_FOR_BANCOLOMBIA_CONFIRMATION
```

---

## 1. Responsabilidades Separadas de Arquitectura

El ecosistema QR de Bancolombia desacopla la generación del código QR de la verificación de transacciones en dos productos independientes:

```
+------------------------------------+        +-----------------------------------------------+
|       BancolombiaQrProvider        |        |      BancolombiaQrPaymentStatusProvider       |
|         (QR Code 3.0.1)            |        |       (QR Payments Information 2.0.0)         |
+------------------------------------+        +-----------------------------------------------+
| • Genera QR en caja física         |        | • Consulta estado del pago en mostrador       |
| • POST /qr-codes                   |        | • POST /retrieve-details                      |
| • Devuelve qrId y qrImage (SVG)    |        | • Filtro por transactionReference (ej. MM-...) |
+------------------------------------+        +-----------------------------------------------+
```

---

## 2. QR Code 3.0.1 (QR Management)

### CONFIRMED (Confirmado)
- **Propósito**: Exclusivamente generación y emisión de códigos QR.
- **Base URL Sandbox**:
  ```
  https://gw-sandbox-qa.apps.ambientesbc.com/public-partner/sb/v3/sales-service/customer-management/customer-product-and-service-directory/qr-code/qr-management
  ```
- **Operaciones**: `POST /qr-codes`, `HEAD /health`.
- **Scope OAuth**: `qr-codes:write:app`.
- **Parámetros request**:
  - `nature`: `'DINAMICO'` | `'ESTATICO'` | `'HIBRIDO'`
  - `purposeOfTransaction`: `'COMPRA'`
  - `transactions.transactionReference`: Referencia propia de Megamundo (ej. `MM-000123`).
  - `transactions.amount`: Valor monetario de la transacción.
  - `commerce.merchantId`: Identificador del comercio asignado por Bancolombia.
- **Respuesta exitosa**: `data.qrId`, `data.qrImage` (cadena SVG codificada).

### NOT DOCUMENTED / NO OFRECIDO
- ❌ No incluye consulta de estado de pago ni transacciones.
- ❌ No incluye webhook, callback HTTP ni `confirmationURL`.
- ❌ No ofrece endpoint GET separado para descargar el QR (la imagen ya viene embebida en `data.qrImage`).

---

## 3. QR Payments Information 2.0.0 (Transactions)

### CONFIRMED (Confirmado)
- **Propósito**: Consulta y detalle de transacciones de pago realizadas vía QR.
- **Base URL Sandbox**:
  ```
  https://gw-sandbox-qa.apps.ambientesbc.com/public-partner/sb/v2/sales-service/servicing/payment-initiation/qr-payments-information/transactions
  ```
- **Operación**: `POST /retrieve-details`.
- **Scope**: `retrieve-details-qr:read:app`.
- **Header Requerido**: `message-id` (UUID v4).
- **Request Body**:
  - `data.requestInfo.keyValue`
  - `data.requestInfo.transactionDate` (YYYY-MM-DD)
  - Uno de: `data.requestInfo.transactionReference` o `data.requestInfo.trackingNumber`.
- **Campos de Respuesta Confirmados**:
  `merchantId`, `merchantName`, `transactionDateTime`, `trackingNumber`, `transactionReference`, `transactionStatus`, `stateReason`, `totalAmount`, `currency`, `detailedAmount`, `debtor`, `debtorAccount`, `creditor`, `creditorAccount`, `proxy`, `qrInfo` (`qrId`, `qrType`, `qrVersion`, `pointOfSale`, `seller`, `cashRegister`).
- **Estado de Pago Confirmado**:
  - `transactionStatus == "approved"` ➔ Mapea a estado interno **`APPROVED`**.
- **Respuesta HTTP 404**:
  - Definición del banco: *"No existe información asociada con la consulta."*
  - **Tratamiento interno obligatorio**: Se mapea como **`PAYMENT_NOT_FOUND_YET`**.
  - **NUNCA** se interpreta como `PAYMENT_REJECTED` ni como prueba definitiva de `NOT_PAID`. Permite reintento en ventana controlada de sondeo.

### NOT DOCUMENTED (No Documentado)
- ❌ Estados en `transactionStatus` distintos de `"approved"` (no inventar mappings para `pending`, `rejected`, `reversed`, `expired`, `cancelled`). Cualquier valor no reconocido se mapea a **`UNKNOWN_PROVIDER_STATUS`** y nunca a `APPROVED`.
- ❌ Búsqueda por `qrId`: `searchByQrId: NOT_SUPPORTED`. No se puede buscar por `qrId`, solo por `transactionReference` o `trackingNumber`. (No obstante, `qrInfo.qrId` sí viene en la respuesta).

### WAITING FOR BANCOLOMBIA (Pendiente de Confirmación)
- ⚠️ **`keyValue`**: Documentado como *"Valor de la llave asignada al QR"*. **NO asumir `keyValue == merchantId`**. Marcado como `WAITING_FOR_BANCOLOMBIA_CONFIRMATION`.
- ⚠️ **Inconsistencia de Autenticación**: El Overview de la documentación menciona API Key, mientras el contrato de la operación `POST /retrieve-details` define OAuth 2.0 Client Credentials (`retrieve-details-qr:read:app`). Marcado como `QR_PAYMENTS_AUTH_STATUS: WAITING_FOR_BANCOLOMBIA_CONFIRMATION`. No se implementa autenticación especulativa.
- ⚠️ **Webhooks**: Ningún contrato analizado expone endpoints de callback. `QR_WEBHOOK_STATUS: NEEDS_BANCOLOMBIA_CONFIRMATION`.

---

## 4. Regla Estricta de Confirmación Automática

Una venta solo pasa automáticamente a **`APPROVED`** si se cumplen simultáneamente:
1. `provider == BANCOLOMBIA`
2. `transactionStatus == "approved"`
3. `amount == expectedAmount` (Comparación estricta de enteros COP, sin floats).
4. `transactionReference == expectedReference`
5. `qrId == expectedQrId` (cuando esté presente en criterio y en `response.qrInfo.qrId`).

> [!CAUTION]
> Si cualquiera de estas validaciones falla, **NO se confirma el pago** y se genera un registro de auditoría / discrepancia.

---

## 5. Estrategia de Sondeo (PaymentVerificationPoller)

Diseñado como servicio conceptual desacoplado:
1. Inicia cuando se emite un QR para cobro en caja.
2. Consulta `PaymentStatusProvider` periódicamente.
3. Se detiene **inmediatamente** ante `transactionStatus == "approved"`.
4. Aplica ventana máxima de timeout y backoff razonable (política interna Megamundo, no contractual del banco):
   - Primeros 30s: cada 2 segundos.
   - 30s a 90s: cada 5 segundos.
   - 90s en adelante: cada 10 segundos.
   - Timeout total: 5 minutos.
