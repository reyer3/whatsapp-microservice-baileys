import makeWASocket, {
  DisconnectReason,
  ConnectionState,
  WASocket,
  useMultiFileAuthState,
  proto,
  WAMessage,
  AuthenticationState,
  SignalDataTypeMap,
  Browsers,
  MessageUpsertType
} from 'baileys';
import crypto from 'crypto';
import qrcode from 'qrcode-terminal';
import { WhatsAppService, WhatsAppConfig, MessagePayload, IncomingMessage } from '../types';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

// Asegurar que crypto esté disponible globalmente
if (typeof global !== 'undefined' && !global.crypto) {
  global.crypto = crypto;
}

// También para el objeto global de Node.js
if (typeof globalThis !== 'undefined' && !globalThis.crypto) {
  globalThis.crypto = crypto;
}

export class BaileysWhatsAppService extends EventEmitter implements WhatsAppService {
  private socket: WASocket | null = null;
  private connected = false;
  private config: WhatsAppConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private messageStore: Map<string, WAMessage> = new Map();

  constructor(config: WhatsAppConfig) {
    super();
    this.config = config;
    
    // Advertencia sobre el uso en producción
    if (process.env.NODE_ENV === 'production') {
      logger.warn('⚠️  ADVERTENCIA: useMultiFileAuthState no debería usarse en producción');
      logger.warn('⚠️  Implementa tu propio sistema de autenticación con base de datos');
    }

    // Verificar que crypto esté disponible
    try {
      crypto.randomBytes(16);
      logger.debug('✅ Módulo crypto disponible y funcionando');
    } catch (error) {
      logger.error('❌ Error con módulo crypto:', error);
    }
  }

  async connect(): Promise<void> {
    try {
      logger.info('Iniciando conexión a WhatsApp...');
      logger.debug(`Directorio de autenticación: ${this.config.authFolder}`);
      
      const { state, saveCreds } = await useMultiFileAuthState(this.config.authFolder);
      logger.debug('Estado de autenticación cargado correctamente');
      
      this.socket = makeWASocket({
        auth: state,
        browser: Browsers.ubuntu('WhatsApp Microservice'),
        logger: this.createPinoLogger(),
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        getMessage: this.getMessage.bind(this),
        printQRInTerminal: false,
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 60000,
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 5,
        emitOwnEvents: true,
        // Configuraciones adicionales para evitar problemas de crypto
        shouldSyncHistoryMessage: () => false,
        shouldIgnoreJid: () => false,
      });

      logger.debug('Socket WhatsApp creado correctamente');
      this.setupEventHandlers(saveCreds);
      
    } catch (error) {
      logger.error('Error al conectar con WhatsApp:', error);
      
      // Diagnóstico específico para errores de crypto
      if (error.message && error.message.includes('crypto')) {
        logger.error('❌ Error relacionado con crypto detectado');
        logger.error('💡 Intenta reiniciar el contenedor o verificar la versión de Node.js');
      }
      
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      logger.info('Desconectando de WhatsApp...');
      try {
        this.socket.end(new Error('Desconexión solicitada'));
      } catch (error) {
        logger.warn('Error al cerrar socket:', error);
      }
      this.socket = null;
      this.connected = false;
      this.messageStore.clear();
    }
  }

  async sendMessage(payload: MessagePayload): Promise<boolean> {
    if (!this.socket || !this.connected) {
      throw new Error('WhatsApp no está conectado');
    }

    try {
      const jid = this.formatPhoneNumber(payload.to);
      
      const sentMessage = await this.socket.sendMessage(jid, {
        text: payload.message
      });

      // Almacenar mensaje para getMessage
      if (sentMessage && sentMessage.key.id) {
        this.messageStore.set(sentMessage.key.id, sentMessage);
      }

      logger.info(`Mensaje enviado a ${payload.to}:`, payload.message);
      return true;
      
    } catch (error) {
      logger.error('Error al enviar mensaje:', error);
      return false;
    }
  }

  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.socket) {
      throw new Error('Socket no inicializado');
    }

    try {
      const code = await this.socket.requestPairingCode(phoneNumber);
      logger.info(`Código de emparejamiento generado para ${phoneNumber}: ${code}`);
      return code;
    } catch (error) {
      logger.error('Error al generar código de emparejamiento:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getSocket(): WASocket | null {
    return this.socket;
  }

  private async getMessage(key: proto.IMessageKey): Promise<proto.IMessage | undefined> {
    if (!key.id) return undefined;
    
    const message = this.messageStore.get(key.id);
    return message?.message || undefined;
  }

  private setupEventHandlers(saveCreds: () => Promise<void>): void {
    if (!this.socket) return;

    logger.debug('Configurando event handlers...');

    // Manejo de cambios de conexión
    this.socket.ev.on('connection.update', this.handleConnectionUpdate.bind(this));
    
    // Guardar credenciales cuando cambien
    this.socket.ev.on('creds.update', saveCreds);
    
    // Manejo de mensajes entrantes
    this.socket.ev.on('messages.upsert', this.handleIncomingMessages.bind(this));

    // Almacenar mensajes para getMessage
    this.socket.ev.on('messages.upsert', ({ messages }) => {
      messages.forEach(msg => {
        if (msg.key.id) {
          this.messageStore.set(msg.key.id, msg);
        }
      });
    });

    logger.debug('Event handlers configurados correctamente');
  }

  private handleConnectionUpdate(update: Partial<ConnectionState>): void {
    const { connection, lastDisconnect, qr } = update;
    
    logger.debug('Connection update:', { connection, qr: !!qr, lastDisconnect: !!lastDisconnect });

    // Manejar código QR
    if (qr) {
      logger.info('📱 Código QR generado - escanear con WhatsApp');
      if (this.config.printQRInTerminal) {
        qrcode.generate(qr, { small: true });
      }
      this.emit('qr', qr);
    }

    // Manejar conexión cerrada
    if (connection === 'close') {
      this.connected = false;
      
      // Mejorar el manejo de errores incluyendo crypto
      let statusCode: number | undefined;
      let errorMessage = 'Error desconocido';
      
      if (lastDisconnect?.error) {
        const error = lastDisconnect.error as any;
        
        // Extraer código de estado
        statusCode = error.output?.statusCode || error.statusCode || error.code;
        
        // Extraer mensaje de error
        errorMessage = error.message || error.toString();
        
        // Diagnóstico específico para errores de crypto
        if (errorMessage.includes('crypto')) {
          logger.error('🔐 Error de crypto detectado:', errorMessage);
          logger.error('💡 Solución: Reiniciar contenedor o verificar configuración de Node.js');
          statusCode = 'CRYPTO_ERROR' as any;
        }
        
        // Logging mejorado del error completo
        logger.debug('Error completo:', {
          message: errorMessage,
          statusCode,
          stack: error.stack,
          name: error.name
        });
      }
      
      logger.warn(`Conexión cerrada. Código: ${statusCode}, Error: ${errorMessage}`);
      
      // Decidir si reconectar
      let shouldReconnect = true;
      
      if (statusCode) {
        switch (statusCode) {
          case DisconnectReason.badSession:
            logger.error('❌ Sesión inválida. Eliminar archivos de autenticación y reiniciar.');
            shouldReconnect = false;
            break;
          case DisconnectReason.connectionClosed:
            logger.warn('🔄 Conexión cerrada por el servidor.');
            break;
          case DisconnectReason.connectionLost:
            logger.warn('📡 Conexión perdida.');
            break;
          case DisconnectReason.connectionReplaced:
            logger.warn('🔄 Conexión reemplazada por otra sesión.');
            shouldReconnect = false;
            break;
          case DisconnectReason.loggedOut:
            logger.warn('👋 Sesión cerrada por el usuario.');
            shouldReconnect = false;
            break;
          case DisconnectReason.restartRequired:
            logger.info('🔄 Reinicio requerido.');
            break;
          case DisconnectReason.timedOut:
            logger.warn('⏰ Tiempo de conexión agotado.');
            break;
          case 'CRYPTO_ERROR':
            logger.error('🔐 Error de crypto - no reconectar automáticamente');
            shouldReconnect = false;
            break;
          default:
            logger.warn(`❓ Código de desconexión: ${statusCode}`);
        }
      } else {
        // Si no hay código, verificar el mensaje de error
        if (errorMessage.includes('crypto')) {
          logger.error('🔐 Error de crypto sin código de estado');
          shouldReconnect = false;
        } else {
          logger.warn('🌐 Error de conexión de red o inicialización');
        }
      }
      
      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        logger.info(`🔄 Intentando reconectar... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => this.connect(), 3000);
      } else {
        logger.error('❌ Máximo número de intentos de reconexión alcanzado o reconexión no permitida');
        this.emit('disconnected');
      }
    } 
    // Manejar conexión establecida
    else if (connection === 'open') {
      this.connected = true;
      this.reconnectAttempts = 0;
      logger.info('✅ Conectado exitosamente a WhatsApp');
      this.emit('connected');
    }
    // Manejar estado de conexión
    else if (connection === 'connecting') {
      logger.info('🔄 Conectando a WhatsApp...');
    }
  }

  private handleIncomingMessages(m: { messages: WAMessage[]; type: MessageUpsertType; requestId?: string }): void {
    for (const message of m.messages) {
      if (message.key.fromMe) continue;

      const incomingMessage = this.parseIncomingMessage(message);
      if (incomingMessage) {
        logger.info(`📨 Mensaje recibido de ${incomingMessage.from}: ${incomingMessage.message}`);
        this.emit('message', incomingMessage);
      }
    }
  }

  private parseIncomingMessage(message: WAMessage): IncomingMessage | null {
    const messageContent = message.message?.conversation || 
                          message.message?.extendedTextMessage?.text;
    
    if (!messageContent) return null;

    return {
      from: message.key.remoteJid || '',
      message: messageContent,
      timestamp: message.messageTimestamp as number,
      messageId: message.key.id || ''
    };
  }

  private formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length < 10) {
      throw new Error('Número de teléfono demasiado corto');
    }
    
    if (!cleaned.startsWith('51') && cleaned.length === 9) {
      return `51${cleaned}@s.whatsapp.net`;
    }
    
    return `${cleaned}@s.whatsapp.net`;
  }

  private createPinoLogger() {
    return {
      level: 'silent',
      child: () => this.createPinoLogger(),
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      fatal: () => {}
    };
  }
}