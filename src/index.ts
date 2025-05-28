import { Server } from './server';
import { logger } from './utils/logger';

// Crear instancia del servidor
const server = new Server();

// Manejo de señales del sistema para cierre limpio
const gracefulShutdown = async (signal: string) => {
  logger.info(`Recibida señal ${signal}. Cerrando aplicación...`);
  
  try {
    await server.stop();
    logger.info('Aplicación cerrada correctamente');
    process.exit(0);
  } catch (error) {
    logger.error('Error durante el cierre:', error);
    process.exit(1);
  }
};

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  logger.error('Excepción no capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesa rechazada no manejada:', { reason, promise });
  process.exit(1);
});

// Señales de terminación
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Iniciar servidor
(async () => {
  try {
    await server.start();
  } catch (error) {
    logger.error('Error al iniciar la aplicación:', error);
    process.exit(1);
  }
})();