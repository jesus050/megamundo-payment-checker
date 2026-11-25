import { buildApp } from './app';
import { config } from './config';

async function start() {
  const app = buildApp();

  try {
    const address = await app.listen({
      port: config.port,
      host: config.host,
    });
    console.log(`🚀 Servidor Megamundo API escuchando en: ${address}`);
    console.log(`📡 Canal SSE disponible en: ${address}/api/realtime/stream`);
    console.log(`🔍 Health check disponible en: ${address}/api/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
