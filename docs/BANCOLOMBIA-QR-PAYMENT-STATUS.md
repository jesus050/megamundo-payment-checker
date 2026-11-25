# Bancolombia QR Payments Information (Transactions)

```yaml
PRODUCT: Qr Payments Information - Transactions
VERSION: 2.0.0
BASE URL SANDBOX: https://gw-sandbox-qa.apps.ambientesbc.com/public-partner/sb/v2/sales-service/servicing/payment-initiation/qr-payments-information/transactions
OPERATION: POST /retrieve-details
SCOPE: retrieve-details-qr:read:app
REQUIRED_HEADER: message-id (UUID v4)
INTEGRATION STATUS: DISABLED
AUTH STATUS: WAITING_FOR_BANCOLOMBIA_CONFIRMATION
```

---

## 1. Clasificación del Contrato Oficial

### CONFIRMED (Confirmado en Contrato)
- **Operación**: `POST /retrieve-details`
- **Header Requerido**: `message-id` (UUID v4 estándar).
- **Request Info**:
  - `data.requestInfo.keyValue`: Llave asignada al QR.
  - `data.requestInfo.transactionDate`: Fecha de la transacción en formato YYYY-MM-DD.
  - Criterio de búsqueda (uno requerido): `transactionReference` (referencia del comercio) o `trackingNumber`.
- **Atributos de Respuesta**:
  - `merchantId`, `merchantName`, `transactionDateTime`, `trackingNumber`, `transactionReference`, `transactionStatus`, `stateReason`, `totalAmount`, `currency`, `detailedAmount`, `debtor`, `debtorAccount`, `creditor`, `creditorAccount`, `proxy`, `qrInfo` (`qrId`, `qrType`, `qrVersion`, `pointOfSale`, `seller`, `cashRegister`).
- **Estado de Transacción**:
  - Único valor documentalmente confirmado: `"approved"` ➔ Mapea a **`APPROVED`**.
- **Comportamiento ante HTTP 404**:
  - Significado: *"No existe información asociada con la consulta."*
  - Tratamiento interno: **`PAYMENT_NOT_FOUND_YET`**. No indica rechazo ni falla definitiva; permite reintento durante el ciclo de sondeo.

---

### NOT DOCUMENTED (No Documentado en Contrato)
- **Estados de Transacción Adicionales**: No existen en la documentación valores como `pending`, `rejected`, `reversed`, `expired`, `cancelled`.
  - Regla: Cualquier valor distinto a `"approved"` se clasifica como **`UNKNOWN_PROVIDER_STATUS`**. NUNCA se asume como aprobado.
- **Búsqueda directa por `qrId`**: La operación `POST /retrieve-details` **no permite** filtrar por `qrId` en el request (solo por `transactionReference` o `trackingNumber`).
- **Paginación y Rate Limits**: No se declaran límites explícitos ni estrategias de paginación en el OpenAPI de esta versión.

---

### WAITING FOR BANCOLOMBIA (Pendiente de Aclaración con la Entidad)
- **Mapeo de `keyValue`**:
  - Documentado únicamente como: *"Valor de la llave asignada al QR"*.
  - **NO se asume que `keyValue == merchantId`**. Pendiente confirmación técnica con soporte de Bancolombia.
- **Inconsistencia de Autenticación**:
  - La sección Overview menciona autenticación mediante API Key.
  - La definición de `POST /retrieve-details` exige OAuth 2.0 Client Credentials con scope `retrieve-details-qr:read:app`.
  - Estado: `QR_PAYMENTS_AUTH_STATUS = WAITING_FOR_BANCOLOMBIA_CONFIRMATION`.

---

## 2. Matriz de Capacidades de `BancolombiaQrPaymentStatusProvider`

| Capacidad | Estado Oficial | Observación |
| :--- | :--- | :--- |
| `retrievePaymentDetails` | `OFFICIAL_CONTRACT_AVAILABLE` | Contrato revisado para `POST /retrieve-details`. |
| `searchByTransactionReference` | `SUPPORTED` | Búsqueda por la referencia de venta generada en caja (ej. `MM-000123`). |
| `searchByTrackingNumber` | `SUPPORTED` | Búsqueda por el número de rastreo bancario. |
| `searchByQrId` | `NOT_SUPPORTED` | El request no admite `qrId` como filtro de consulta. |
| `transactionStatusApproved` | `SUPPORTED` | Mapeo 1:1 de `"approved"` a `APPROVED`. |
| `completeStatusEnum` | `NOT_DOCUMENTED` | Pendiente catálogo de otros posibles estados de pago. |
| `keyValueMapping` | `NOT_CONFIRMED` | Pendiente verificar qué valor exacto debe enviarse en `keyValue`. |

---

## 3. Modelo de Sondeo (`PaymentVerificationPoller`)

Dado que ni *QR Code 3.0.1* ni *QR Payments Information 2.0.0* ofrecen webhooks, la confirmación en mostrador se apoya en un sondeo reactivo:

1. **Gatillo**: Se activa al generarse un QR con referencia comercial única.
2. **Ciclo**: Consulta `BancolombiaQrPaymentStatusProvider` por `transactionReference`.
3. **Parada Temprana**: Se detiene tan pronto como se valida la regla de aprobación.
4. **Cadencia Interna**:
   - $t \in [0, 30s]$: Cada 2 segundos.
   - $t \in (30s, 90s]$: Cada 5 segundos.
   - $t > 90s$: Cada 10 segundos.
   - $t_{max}$: 5 minutos.
