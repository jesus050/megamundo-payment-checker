#!/bin/bash
set -e

echo "=========================================================="
echo "🚀 INICIANDO INSTALACIÓN DE MEGAMUNDO PAYMENT CHECKER"
echo "=========================================================="

# 1. Actualizar sistema e instalar utilidades básicas
echo "📦 Actualizando paquetes de Ubuntu..."
apt update && apt upgrade -y
apt install -y curl wget git ufw nginx software-properties-common

# 2. Instalar Node.js 20 LTS
echo "🟢 Instalando Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "Node versión: $(node -v)"
echo "NPM versión: $(npm -v)"

# 3. Instalar PM2 globalmente
echo "⚡ Instalando PM2..."
npm install -g pm2

# 4. Instalar y configurar PostgreSQL 16
echo "🐘 Instalando y configurando PostgreSQL..."
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# Crear usuario y base de datos de producción
echo "🔑 Configurando base de datos megamundo_payments..."
sudo -u postgres psql -c "DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'megamundo_user') THEN
    CREATE USER megamundo_user WITH PASSWORD 'MegamundoDb2026_SecurePass!';
  END IF;
END
\$\$;"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'megamundo_payments'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE megamundo_payments OWNER megamundo_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE megamundo_payments TO megamundo_user;"

# 5. Descargar o actualizar el proyecto
echo "📂 Descargando código del proyecto..."
mkdir -p /var/www
cd /var/www
if [ -d "megamundo-payment-checker" ]; then
  cd megamundo-payment-checker
  git pull origin main
else
  git clone https://github.com/jesus050/megamundo-payment-checker.git
  cd megamundo-payment-checker
fi

# 6. Crear archivo .env de producción
echo "⚙️ Configurando variables de entorno (.env)..."
cat << 'EOF' > .env
DATABASE_URL="postgresql://megamundo_user:MegamundoDb2026_SecurePass!@localhost:5432/megamundo_payments?schema=public"
APP_SECRET="megamundo-super-secure-production-jwt-key-2026-vps-99"
ALLOWED_ORIGINS="*"
PORT=3001
HOST=0.0.0.0
NODE_ENV=production

# Integración Zernio (SMS y Correo Bancolombia)
ZERNIO_INTEGRATION_ENABLED=true
ZERNIO_WEBHOOK_SECRET=

# Bancolombia API Directa (Deshabilitada hasta contrato oficial)
BANCOLOMBIA_INTEGRATION_ENABLED=false
BANCOLOMBIA_ENV=sandbox
BANCOLOMBIA_CLIENT_ID=
BANCOLOMBIA_CLIENT_SECRET=
BANCOLOMBIA_CALLBACK_URL=
EOF

# 7. Compilar proyecto y sincronizar base de datos
echo "🔨 Compilando proyecto y ejecutando migraciones..."
npm install
npx prisma generate --schema=packages/database/prisma/schema.prisma
npm run build
npx prisma db push --schema=packages/database/prisma/schema.prisma
npm run db:seed

# 8. Iniciar servicio con PM2
echo "🚀 Levantando aplicación con PM2..."
pm2 stop megamundo-pagos 2>/dev/null || true
pm2 delete megamundo-pagos 2>/dev/null || true
pm2 start npm --name "megamundo-pagos" -- run start --workspace=@megamundo/api
pm2 save
pm2 startup systemd -u root --hp /root || true

# 9. Configurar Nginx como Reverse Proxy con soporte SSE en tiempo real
echo "🌐 Configurando Nginx..."
cat << 'EOF' > /etc/nginx/sites-available/megamundo-pagos
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Soporte para Server-Sent Events (SSE) en tiempo real
        proxy_buffering off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/megamundo-pagos /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# 10. Configurar Firewall (UFW)
echo "🛡️ Configurando Firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo ""
echo "=========================================================="
echo "🎉 ¡INSTALACIÓN COMPLETADA EXITOSAMENTE EN TU VPS!"
echo "=========================================================="
echo "🌐 Abre en tu navegador: http://2.24.217.4"
echo "🔑 Usuario: cajero@megamundo.com"
echo "🔑 Clave:   Megamundo2026!*"
echo ""
echo "🔗 URL Webhook para Zernio: http://2.24.217.4/api/webhooks/zernio"
echo "=========================================================="
