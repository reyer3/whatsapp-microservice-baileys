import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { createWhatsAppRoutes } from './routes/whatsapp.routes';
import { BaileysWhatsAppService } from './services/whatsapp.service';
import { logger } from './utils/logger';
import { APIResponse } from './types';

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
      stream: { write: (message: string) => logger.info(message.trim()) }
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
          whatsappConnected: this.whatsappService.isConnected(),
          version: '1.0.0'
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
        description: 'Microservicio para conectar instancias WhatsApp usando Baileys',
        endpoints: {
          health: {
            method: 'GET',
            path: '/health',
            description: 'Verificar estado del servicio',
            auth: false
          },
          whatsapp: {
            status: {
              method: 'GET',
              path: '/api/whatsapp/status',
              description: 'Obtener estado de conexión WhatsApp',
              auth: 'opcional'
            },
            connect: {
              method: 'POST',
              path: '/api/whatsapp/connect',
              description: 'Conectar a WhatsApp (genera QR)',
              auth: true
            },
            pairingCode: {
              method: 'POST',
              path: '/api/whatsapp/pairing-code',
              description: 'Generar código de emparejamiento',
              auth: true,
              body: { phoneNumber: 'string (E.164 sin +)' }
            },
            send: {
              method: 'POST',
              path: '/api/whatsapp/send',
              description: 'Enviar mensaje de texto',
              auth: true,
              body: { to: 'string', message: 'string' }
            },
            disconnect: {
              method: 'POST',
              path: '/api/whatsapp/disconnect',
              description: 'Desconectar de WhatsApp',
              auth: true
            }
          }
        },
        authentication: {
          type: 'API Key',
          header: 'x-api-key',
          note: 'Requerido para todas las rutas protegidas'
        },
        connectionMethods: {
          qr: 'Usar /api/whatsapp/connect y escanear QR desde logs',
          pairingCode: 'Usar /api/whatsapp/pairing-code con número de teléfono'
        }
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
      logger.info('✅ WhatsApp conectado exitosamente');
    });

    this.whatsappService.on('disconnected', () => {
      logger.warn('❌ WhatsApp desconectado');
    });

    this.whatsappService.on('qr', (qr: string) => {
      logger.info('📱 Código QR generado para WhatsApp - Escanear con la app');
      logger.info('📱 O usar el endpoint /api/whatsapp/pairing-code para código de emparejamiento');
    });

    this.whatsappService.on('message', (message: any) => {
      logger.info(`📨 Nuevo mensaje de ${message.from}: ${message.message}`);
    });
  }

  public async start(): Promise<void> {
    try {
      // Iniciar servidor HTTP
      this.app.listen(config.server.port, () => {
        logger.info(`🚀 Servidor iniciado en puerto ${config.server.port}`);
        logger.info(`📱 Modo: ${config.server.nodeEnv}`);
        logger.info(`🔗 Health check: http://localhost:${config.server.port}/health`);
        logger.info(`📖 Documentación: http://localhost:${config.server.port}/`);
        
        if (config.server.nodeEnv === 'production') {
          logger.warn('⚠️  ADVERTENCIA: Estás usando useMultiFileAuthState en producción');
          logger.warn('⚠️  Considera implementar un sistema de autenticación con base de datos');
        }
      });

      // Iniciar conexión de WhatsApp
      logger.info('📱 Iniciando conexión a WhatsApp...');
      await this.whatsappService.connect();

    } catch (error) {
      logger.error('❌ Error al iniciar el servidor:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    logger.info('🛑 Cerrando servidor...');
    await this.whatsappService.disconnect();
    process.exit(0);
  }

  public getApp(): express.Application {
    return this.app;
  }
}