# Guía de Pruebas y Simulaciones: Megamundo

## 1. Ejecución de Pruebas Automatizadas

El proyecto cuenta con una suite completa de pruebas unitarias y de integración construida sobre **Vitest**, que valida los 12 escenarios críticos exigidos por el requerimiento de negocio.

Para ejecutar toda la suite de pruebas:

```bash
npm run test
```

Salida esperada:
```
 Test Files  2 passed (2)
      Tests  12 passed (12)
```

---

## 2. Los 12 Escenarios Verificados

| # | Escenario | Ubicación del Test | Resultado Verificado |
| :-: | :--- | :--- | :--- |
| **1** | **Pago aprobado** | `payment-scenarios.test.ts` | Estado `APPROVED`, `paidAt` presente, evento SSE `payment.created` emitido |
| **2** | **Pago rechazado** | `payment-scenarios.test.ts` | Estado `REJECTED`, `paidAt` en null |
| **3** | **Pago pendiente** | `payment-scenarios.test.ts` | Estado `PENDING`, no confirma fondos |
| **4** | **Dos pagos del mismo valor** | `payment-scenarios.test.ts` | Dos registros `Payment` con diferentes IDs y referencias sin colisión |
| **5** | **Webhook duplicado (Idempotencia)** | `payment-scenarios.test.ts` | Detección por `(provider, externalEventId)`, no duplica pagos, retorna `IGNORED_DUPLICATE` y registra auditoría |
| **6** | **Firma inválida** | `payment-scenarios.test.ts` | Rechazo con `REJECTED_SIGNATURE_INVALID`, registro en `PaymentEvent` y auditoría de seguridad |
| **7** | **Payload inválido** | `payment-scenarios.test.ts` | Detección de monto <= 0 o error estructural con `FAILED_INVALID_PAYLOAD` |
| **8** | **Pago sin venta asociada** | `payment-scenarios.test.ts` | El pago bancario se registra limpiamente con `saleId = null` |
| **9** | **Pago asociado a venta** | `payment-scenarios.test.ts` | Referencia coincidente vincula la venta y actualiza su estado a `PAID` |
| **10** | **Dos eventos simultáneos** | `payment-scenarios.test.ts` | Ejecución en paralelo con `Promise.all` preservando consistencia |
| **11** | **Base de datos no disponible** | `resilience-and-realtime.test.ts` | `/api/health` retorna 503 degradado sin abortar el proceso |
| **12** | **Reconexión de Dashboard** | `resilience-and-realtime.test.ts` | Desconexión y re-suscripción de clientes SSE sin fugas de memoria |

---

## 3. Pruebas Manuales desde la Interfaz Web

1. Iniciar la aplicación:
   ```bash
   npm run dev
   ```
2. Abrir en el navegador [http://localhost:5173/dev/payments](http://localhost:5173/dev/payments) (Simulador).
3. Abrir en otra ventana o pestaña [http://localhost:5173/terminal](http://localhost:5173/terminal) (Terminal de Caja).
4. En el simulador, presionar **SIMULAR PAGO** (\$185.000, APPROVED).
5. Observar cómo en menos de 1 segundo:
   - El terminal de caja se actualiza automáticamente sin refrescar la página.
   - Suena el timbre acústico armónico de caja.
   - Aparece la tarjeta del último pago en grande.
6. Probar los botones de escenarios rápidos en el simulador:
   - **Webhook Duplicado**: Verifica que no cree dos pagos.
   - **Firma Inválida**: Verifica que el estado de respuesta sea rechazado.
   - **2 Pagos Mismo Monto**: Verifica que aparezcan 2 transacciones separadas con horas distintas.
