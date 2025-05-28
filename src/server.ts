import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from '../config';
import { createWhatsAppRoutes } from '../routes/whatsapp.routes';
import { BaileysWhatsAppService } from '../services/whatsapp.service';
import { logger } from '../utils/logger';
import { APIResponse } from '../types';

export class Server {
  private app: express.Application;
  private whatsappService: BaileysWhatsAppService;

  constructor() {
    this.app = express();
    this.whatsappService = new BaileysWhatsAppService(config.whatsapp);
    this.setupMiddlewares();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupWhatsAppEventHandlers();
  }

  private setupMiddlewares(): void {
    // Seguridad
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true
    }));

    // Logging de requests
    this.app.use(morgan('combined', {
      stream: { write: (message) => logger.info(message.trim()) }
    }));

    // Parseo de JSON
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // Ruta de health check
    this.app.get('/health', (req, res) => {
      const response: APIResponse = {
        success: true,
        message: 'Servicio funcionando correctamente',
        data: {
          status: 'healthy',
          timestamp: new Date(),
          uptime: process.uptime(),
          whatsappConnected: this.whatsappService.isConnected()
        }
      };
      res.json(response);
    });

    // Rutas de WhatsApp
    this.app.use('/api/whatsapp', createWhatsAppRoutes(this.whatsappService));

    // Ruta para documentación básica
    this.app.get('/', (req, res) => {
      res.json({
        service: 'WhatsApp Microservice with Baileys',
        version: '1.0.0',
        endpoints: {
          health: 'GET /health',
          whatsapp: {
            status: 'GET /api/whatsapp/status',
            send: 'POST /api/whatsapp/send',
            connect: 'POST /api/whatsapp/connect',
            disconnect: 'POST /api/whatsapp/disconnect'
          }
        },
        authentication: 'API Key required (x-api-key header)'
      });
    });

    // Manejo de rutas no encontradas
    this.app.use('*', (req, res) => {
      const response: APIResponse = {
        success: false,
        message: 'Ruta no encontrada',
        error: 'Not Found'
      };
      res.status(404).json(response);
    });
  }

  private setupErrorHandling(): void {
    // Manejo global de errores
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Error no manejado:', error);
      
      const response: APIResponse = {
        success: false,
        message: 'Error interno del servidor',
        error: config.server.nodeEnv === 'development' ? error.message : 'Internal Server Error'
      };
      
      res.status(500).json(response);
    });
  }

  private setupWhatsAppEventHandlers(): void {
    this.whatsappService.on('connected', () => {
      logger.info('WhatsApp conectado exitosamente');
    });

    this.whatsappService.on('disconnected', () => {
      logger.warn('WhatsApp desconectado');
    });

    this.whatsappService.on('qr', (qr: string) => {
      logger.info('Código QR generado para WhatsApp');
    });

    this.whatsappService.on('message', (message) => {
      logger.info(`Nuevo mensaje recibido de ${message.from}: ${message.message}`);
    });
  }

  public async start(): Promise<void> {
    try {
      // Iniciar servidor HTTP
      this.app.listen(config.server.port, () => {
        logger.info(`🚀 Servidor iniciado en puerto ${config.server.port}`);
        logger.info(`📱 Modo: ${config.server.nodeEnv}`);
        logger.info(`🔗 Health check: http://localhost:${config.server.port}/health`);
      });

      // Iniciar conexión de WhatsApp
      logger.info('Iniciando conexión a WhatsApp...');
      await this.whatsappService.connect();

    } catch (error) {
      logger.error('Error al iniciar el servidor:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    logger.info('Cerrando servidor...');
    await this.whatsappService.disconnect();
    process.exit(0);
  }

  public getApp(): express.Application {
    return this.app;
  }
}
