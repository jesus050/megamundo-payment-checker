# Guía de Identidad Visual y Diseño (Branding)
## Megamundo Payment Checker

Este documento define las pautas visuales, la paleta adoptada actualmente, la arquitectura de tokens en Tailwind CSS y el manejo de recursos gráficos para **Comercializadora Megamundo**.

---

## 1. Declaración de Identidad de Marca

> **Estado de la Paleta**: La paleta aquí descrita es la **paleta adoptada actualmente** para Megamundo en este verificador de pagos. **No debe catalogarse ni presentarse como "paleta oficial definitiva"**, ya que está sujeta a directrices corporativas finales del equipo de mercadeo y marca de Megamundo.

### Valores y Principios Visuales
1. **Velocidad de Lectura**: Confirmación de estado en menos de 2 segundos desde el mostrador.
2. **Jerarquía Visual Clara**: Información crítica (monto, estado, cuenta, hora) destacada inmediatamente sin sobrecarga cognitiva.
3. **Contraste y Legibilidad**: Diseñado para visibilidad óptima bajo condiciones de luz intensa en tiendas físicas.
4. **Independencia Semántica**: La identidad de marca (azul/amarillo) no se confunde con los estados transaccionales (verde/amarillo/rojo).

---

## 2. Paleta Adoptada Actualmente

| Token | Hexadecimal | Nombre / Uso |
| :--- | :--- | :--- |
| `brand-primary` | `#1717F4` | **Azul Intenso Principal**: Cabeceras clave, bordes de enfoque, botones primarios, icono de marca. |
| `brand-primary-dark`| `#0e0ee0` | **Azul Hover**: Estado activo/hover de botones e interacciones primarias. |
| `brand-primary-light`| `#eff1fe` | **Azul Pálido**: Fondos de chips, filtros activos, contenedores suaves de marca. |
| `brand-accent` | `#FFD21A` | **Amarillo Acento Principal**: Puntos focales, indicadores de marca, micro-acentos visuales. |
| `brand-accent-warm` | `#F5C400` | **Amarillo Cálido**: Variante de acento cálido para contrastes y bordes secundarios. |
| `brand-background` | `#F6F8FC` | **Fondo General**: Tono neutro gris-azulado frío para reducir fatiga visual en pantallas de caja. |
| `brand-text` | `#111B3D` | **Azul Noche / Texto Principal**: Máximo contraste en tipografía, títulos, montos y datos críticos. |

---

## 3. Tokens Centralizados en Tailwind CSS

Todos los colores de marca están centralizados en `apps/web/tailwind.config.js`:

```javascript
// apps/web/tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1717F4',
          'primary-dark': '#0e0ee0',
          'primary-light': '#eff1fe',
          accent: '#FFD21A',
          'accent-warm': '#F5C400',
          background: '#F6F8FC',
          text: '#111B3D',
        },
      },
    },
  },
};
```

### Reglas de Uso en Componentes
- **NUNCA** utilizar colores hexadecimales de marca directamente (`#1717F4`, `#111B3D`, etc.) en clases de componentes.
- Utilizar exclusivamente las clases de Tailwind generadas:
  - `bg-brand-primary`, `hover:bg-brand-primary-dark`, `text-brand-primary`, `border-brand-primary`
  - `bg-brand-accent`, `text-brand-accent`, `border-brand-accent`
  - `bg-brand-background`
  - `text-brand-text`, `hover:text-brand-text`
  - `bg-brand-primary-light`

---

## 4. Independencia de Colores Semánticos (Estados de Pago)

> **REGLA ESTRICTA**: El color verde (`emerald`) **NO es un color de marca** y nunca debe utilizarse para elementos corporativos genéricos. Se reserva exclusivamente para representar el estado semántico de **PAGO CONFIRMADO / APROBADO**.

| Estado Semántico | Familia Tailwind | Clases Utilizadas | Significado Transaccional |
| :--- | :--- | :--- | :--- |
| **Aprobado / Confirmado** | Emerald / Green | `text-emerald-700 bg-emerald-50 border-emerald-200` | Dinero acreditado en cuenta bancaria. |
| **Pendiente** | Amber / Orange | `text-amber-800 bg-amber-50 border-amber-200` | Transacción iniciada o en proceso de verificación. |
| **Rechazado / Error** | Rose / Red | `text-rose-700 bg-rose-50 border-rose-200` | Pago rechazado, firma inválida o fallo en comunicación. |

El color amarillo de marca (`brand-accent`: `#FFD21A`) es un elemento de identidad, mientras que el amarillo/ámbar de estado (`amber-500`/`amber-800`) es semántico y comunica espera transaccional.

---

## 5. Recursos Gráficos y Logotipo (Logo Fallback vs Oficial)

### Estado Actual de `logo.svg`
- El archivo `apps/web/public/logo.svg` es un **isotipo vectorial provisional / de desarrollo (fallback)**.
- Consiste en un isotipo geométrico estilizado con fondo azul y la letra "M" con un punto amarillo superior.
- **NO DEBE PRESENTARSE COMO EL LOGOTIPO OFICIAL DEFINITIVO**.

### Procedimiento para Incorporar el Logotipo Oficial
1. El directorio reservado para el logo oficial es:
   `apps/web/public/branding/`
   *(No se incluyen archivos ficticios ni placeholders de 1x1).*
2. Cuando la administración de Megamundo suministre el archivo oficial en alta resolución:
   - **Opción preferida (Vectorial):** Guardar como `apps/web/public/branding/megamundo-logo.svg`.
   - **Opción alternativa (Raster):** Guardar como `apps/web/public/branding/megamundo-logo.png`.
3. El componente `Navbar` intentará utilizar el logo real **SOLO** cuando detecte la presencia de un asset válido en dichas rutas.
4. Hasta entonces, el sistema utiliza de manera automática el fallback provisional existente en `apps/web/public/logo.svg` y renderizado en la interfaz.
