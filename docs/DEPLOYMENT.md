# Guía de Despliegue y Ejecución Local: Megamundo

## 1. Requisitos Previos

- **Node.js**: v20.x o superior.
- **npm**: v10.x o superior.
- **PostgreSQL**: v14 o superior (o Postgres.app en macOS).

---

## 2. Configuración de Variables de Entorno

Copiar el archivo `.env.example` a `.env` en la raíz del proyecto:

```bash
cp .env.example .env
```

Editar los parámetros según tu entorno local:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/megamundo_payments?schema=public
APP_SECRET=clave-secreta-para-jwt-megamundo-2026

BANCOLOMBIA_ENV=sandbox
BANCOLOMBIA_CLIENT_ID=
BANCOLOMBIA_CLIENT_SECRET=
BANCOLOMBIA_CALLBACK_URL=

PORT=3001
HOST=0.0.0.0
NODE_ENV=development
```

---

## 3. Instalación y Puesta en Marcha

### Paso 1: Instalar dependencias del monorepo
```bash
npm install
```

### Paso 2: Generar el cliente de base de datos
```bash
npm run db:generate
```

### Paso 3: Inicializar la base de datos (migraciones y seed)
```bash
# Sincronizar esquema con PostgreSQL
npm run db:push

# Cargar usuarios de prueba y cuentas bancarias
npm run db:seed
```

### Paso 4: Iniciar en modo desarrollo (API + Web Frontend)
```bash
npm run dev
```

- **Frontend Web**: [http://localhost:5173](http://localhost:5173)
- **API Fastify**: [http://localhost:3001](http://localhost:3001)
- **Health Check**: [http://localhost:3001/api/health](http://localhost:3001/api/health)
- **Modo Terminal de Caja**: [http://localhost:5173/terminal](http://localhost:5173/terminal)
- **Simulador Dev**: [http://localhost:5173/dev/payments](http://localhost:5173/dev/payments)

---

## 4. Usuarios de Demostración Sembrados

| Rol | Correo | Contraseña | Vistas y Permisos |
| :--- | :--- | :--- | :--- |
| **CASHIER** | `cajero@megamundo.com` | `Cajero123!` | Dashboard, Terminal de Caja, Búsqueda por valor, Asignar venta |
| **ADMIN** | `admin@megamundo.com` | `Admin123!` | Acceso completo + Logs de auditoría |
| **VIEWER** | `auditor@megamundo.com` | `Auditor123!` | Solo lectura para consulta contable |

---

## 5. Compilación para Producción

```bash
npm run build
```

Genera los artefactos de distribución:
- `apps/api/dist`
- `apps/web/dist`
- `packages/*/dist`
