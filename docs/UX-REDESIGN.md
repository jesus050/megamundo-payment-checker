# Especificación de Rediseño UX/UI: Megamundo Payment Checker (Iteración 2)

## 1. Objetivo y Principios

Transformar la interfaz del MVP técnico en una herramienta comercial de alta velocidad operativa para cajas físicas y supervisores de **Comercializadora Megamundo**.

### Principios Fundamentales
1. **Velocidad de Respuesta (< 2 segundos)**: El cajero debe poder verificar si el pago ingresó de un vistazo.
2. **Jerarquía Visual Estricta**:
   1. **Monto**: Mayor peso tipográfico en formato moneda COP.
   2. **Estado**: `CONFIRMADO` (verde esmeralda sobrio), `PENDIENTE` (ámbar), `RECHAZADO` (rojo).
   3. **Tiempo**: Relativo ("Hace 12 segundos", "Hace 3 minutos") con hora exacta como dato secundario.
   4. **Cuenta**: `Cuenta •••• 5027`.
   5. **Referencia**: `· Ref MM-TEST-001`.
3. **Baja Carga Cognitiva**: Se eliminan subtítulos largos, métricas decorativas, gradientes de estilo cripto y botones redundantes (como "Actualizar" manual prominente).
4. **Diseño Comercial Sobrio**: Paleta de fondo claro (`bg-slate-50`), bordes sutiles (`border-slate-200`), tipografía nativa del sistema optimizada para pantallas táctiles y computadores de mostrador.

---

## 2. Cambios por Componente

### A. Navbar (`apps/web/src/components/Navbar.tsx`)
- **Logo y Marca**: Minimalista, `MEGAMUNDO` con isotipo verde limpio.
- **Indicador de Conexión de 3 Estados**:
  - `● CONECTADO` (verde esmeralda)
  - `● RECONECTANDO...` (ámbar)
  - `● SIN CONEXIÓN` (rojo/gris con tooltip de aviso de red)
- **Navegación**: Enlaces rápidos a `Dashboard` y `Terminal de Caja`.
- **Simulador Dev**: Condicionado estrictamente a `import.meta.env.DEV`. En producción queda oculto.
- **Toggle de Audio**: Icono accesible para activar/desactivar el timbre acústico.
- **Menú de Usuario y Acciones Secundarias**: Cierre de sesión y refresco manual relegados a menú secundario.

### B. Dashboard (`apps/web/src/views/DashboardView.tsx`)
- **Título**: "Verificación de pagos" (sin subtítulos explicativos redundantes).
- **Buscador Unificado**:
  - Campo único: `[ Buscar monto, referencia o número de venta... ]`
  - Botón desplegable `[ Filtros ]`:
    - Filtro por estado (`CONFIRMADO`, `PENDIENTE`, `RECHAZADO`).
    - Filtro por cuenta (últimos 4 dígitos).
    - Filtro por tiempo (últimos 15 min, última hora, hoy).
  - Botón de limpieza rápida de filtros.
- **Filas de Pago (`PaymentRow.tsx`)**:
  - Reducción del 25% en altura vertical para mayor densidad y visualización de más transacciones por pantalla.
  - "Sin venta vinculada" se retira de la lista principal y se traslada al modal de detalle.
  - Formato compacto:
    ```
    $ 93.000                                 CONFIRMADO
    Hace 12 segundos
    Cuenta •••• 5027 · Ref MM-TEST-001
    ```

### C. Modo Terminal de Caja (`apps/web/src/views/TerminalView.tsx`)
- **Diseño Sobrio de Fondo Claro**: Se sustituye el diseño oscuro/gradiente por una interfaz limpia, contrastada y legible bajo iluminación de mostrador.
- **Tarjeta Hero "ÚLTIMO PAGO RECIBIDO"**:
  - Check verde grande `✓`.
  - Monto en tipografía extra-bold `text-5xl / text-6xl`.
  - Badge `CONFIRMADO`.
  - Tiempo relativo: `Hace 8 segundos`.
  - Cuenta: `Cuenta •••• 5027`.
- **Feed "PAGOS RECIENTES"**:
  - Lista ultracompacta tipo POS:
    ```
    $ 120.000   ✓   12:13 (Hace 2 min)
    $  50.000   ✓   12:13 (Hace 2 min)
    $ 185.000   ✓   12:12 (Hace 3 min)
    ```
- **Buscador Rápido por Monto**: Caja de texto instantánea para escribir ej. `185000` y ver pagos recientes de ese valor sin recargar.

### D. Modal de Notificación de Nuevo Pago (`PaymentNotificationModal.tsx`)
- **Cola de Notificaciones (Queue)**: Si llegan dos pagos en rápida sucesión, se encolan y se presentan ordenadamente.
- **Auto-Dismiss sin Fricción**: Desaparece automáticamente a los 4 segundos sin obligar a presionar "Aceptar".
- **Botón X de Cierre Inmediato**: Permite al cajero descartarla si necesita ver el fondo inmediatamente.
- **Contenido Esencial**:
  ```
  ✓
  PAGO RECIBIDO
  $ 93.000
  Cuenta •••• 5027
  Hace un momento
  ```

### E. Modal de Detalle (`PaymentDetailModal.tsx`)
- Agrupa la información secundaria completa:
  - Monto y Estado confirmado.
  - Fecha y hora exacta con segundos (`11:32:18 a. m.`).
  - Cuenta receptora y alias.
  - Referencia bancaria y proveedor.
  - ID único de transacción.
  - Venta asociada o formulario para vincular a factura `MM-XXXX`.
  - Historial de eventos crudos del webhook.

---

## 3. Garantía de No Regresión

- **Lógica de Pagos Intacta**: No se tocan endpoints, schemas Prisma, `PaymentService`, ni `BancolombiaPaymentProvider`.
- **Pruebas Automatizadas**: Los 12 tests de Vitest se ejecutarán al terminar el rediseño para revalidar la estabilidad funcional del sistema.
