# Ciclo de Vida de Pagos e Idempotencia: Megamundo

## 1. Estados Canónicos Agnósticos

Para garantizar que el sistema nunca dependa de las nomenclaturas cambiantes o propietarias de los bancos, se definen estados internos normalizados:

| Estado Interno | Significado | Comportamiento en Caja |
| :--- | :--- | :--- |
| **`APPROVED`** | Pago confirmado por el banco emisor y fondos garantizados | Despliega banner gigante, reproduce sonido de éxito y permite liberar mercancía |
| **`PROCESSING`** | En proceso de compensación | Indicador de espera (no se considera confirmado) |
| **`PENDING`** | Transacción generada en espera de abono | No libera mercancía |
| **`REJECTED`** | Rechazado por fondos insuficientes, sospecha de fraude o timeout | Alerta visual en rojo |
| **`CANCELLED`** | Cancelado por el usuario o expirado | Alerta |
| **`REFUNDED`** | Dinero reversado a la cuenta origen | Auditoría obligatoria |
| **`ERROR`** | Falla técnica en la comunicación o firma inválida | Alerta de seguridad |

La clase `ProviderStatusMapper` en `@megamundo/payment-core` es la única responsable de traducir estados heterogéneos a estos estados canónicos.

---

## 2. Idempotencia Estricta

Los proveedores bancarios reintentan callbacks en caso de latencias de red. Para evitar duplicidad de abonos o doble confirmación en caja:

1. El webhook extrae `externalEventId` del payload original.
2. La base de datos tiene un constraint único:
   ```sql
   UNIQUE (provider, externalEventId)
   ```
3. Si el evento ya existe y fue procesado:
   - Responde inmediatamente `HTTP 200 OK` con `{ received: true, duplicate: true, status: 'IGNORED_DUPLICATE' }`.
   - No genera un nuevo registro `Payment`.
   - Registra en `AuditLog` la acción `DUPLICATE_WEBHOOK_IGNORED`.
   - No emite alertas acústicas duplicadas a las cajas.

---

## 3. Manejo de Pagos del Mismo Valor

En una tienda física es frecuente que dos clientes paguen el mismo importe consecutivo (ej. \$185.000 COP).
- El sistema **nunca** asume que dos transacciones de igual monto son la misma compra.
- Cada transacción tiene su propio `providerPaymentId`, `providerReference` y marca de tiempo (`paidAt`).
- En `/terminal` o en el Dashboard, ambos pagos se presentan de forma independiente e inequívoca.

---

## 4. Asociación a Ventas (Nubixor)

1. Un pago puede existir de forma independiente sin `saleId` inicial.
2. Si la referencia bancaria recibida coincide con un número de factura/orden (`saleNumber`, ej. `MM-1058`), la venta se vincula y se actualiza su estado a `PAID`.
3. El personal de caja (`CASHIER`) o administrador (`ADMIN`) puede asociar manualmente un pago a una venta desde el modal de detalles, generando un registro de auditoría inmutable (`ASSOCIATE_PAYMENT_TO_SALE`).
4. **Regla de seguridad**: El cajero nunca puede alterar el valor recibido ni cambiar un estado bancario.
