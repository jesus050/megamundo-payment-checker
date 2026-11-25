# Activos de Marca de Megamundo

Este directorio está reservado exclusivamente para los archivos oficiales de marca de Comercializadora Megamundo.

> **IMPORTANTE**: No deben colocarse archivos ficticios o placeholders en este directorio. El sistema utiliza automáticamente el fallback provisional hasta que se proporcione el asset real.

## Instrucciones para Incorporar el Logotipo Real:

Cuando se cuente con el logo oficial suministrado por la administración de Megamundo, debe colocarse en esta ruta con uno de los siguientes nombres:

1. **Opción preferida (Vectorial):**
   `apps/web/public/branding/megamundo-logo.svg` (servido como `/branding/megamundo-logo.svg`)

2. **Opción alternativa (Imagen de alta resolución):**
   `apps/web/public/branding/megamundo-logo.png` (servido como `/branding/megamundo-logo.png`)
   - Se recomienda PNG con fondo transparente (canal alfa), altura mínima de 64px a 128px (@2x).

## Fallback Provisional:
Hasta que exista un archivo válido en las rutas anteriores, la aplicación utiliza de manera automática el fallback provisional ubicado en `apps/web/public/logo.svg` y renderizado en la interfaz sin depender de ningún archivo ficticio en `/branding/`.

