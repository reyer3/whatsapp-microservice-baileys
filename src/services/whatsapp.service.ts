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
import qrcode from 'qrcode-terminal';
import { WhatsAppService, WhatsAppConfig, MessagePayload, IncomingMessage } from '../types';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

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
  }

  async connect(): Promise<void> {
    try {
      logger.info('Iniciando conexión a WhatsApp...');
      logger.debug(`Directorio de autenticación: ${this.config.authFolder}`);
      
      const { state, saveCreds } = await useMultiFileAuthState(this.config.authFolder);
      logger.debug('Estado de autenticación cargado correctamente');
      
      this.socket = makeWASocket({
        auth: state,
        browser: Browsers.ubuntu('WhatsApp Microservice'), // Cambiado a Ubuntu para mejor compatibilidad
        logger: this.createPinoLogger(),
        generateHighQualityLinkPreview: false, // Deshabilitado para mejor rendimiento
        syncFullHistory: false,
        markOnlineOnConnect: false,
        getMessage: this.getMessage.bind(this),
        printQRInTerminal: false,
        defaultQueryTimeoutMs: 60000,
        connectTimeoutMs: 60000,
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 5,
        emitOwnEvents: true,
      });

      logger.debug('Socket WhatsApp creado correctamente');
      this.setupEventHandlers(saveCreds);
      
    } catch (error) {
      logger.error('Error al conectar con WhatsApp:', error);
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
      
      // Mejorar el manejo de errores
      let statusCode: number | undefined;
      let errorMessage = 'Error desconocido';
      
      if (lastDisconnect?.error) {
        // Intentar diferentes formas de obtener el código de estado
        if (typeof lastDisconnect.error === 'object') {
          const error = lastDisconnect.error as any;
          statusCode = error.output?.statusCode || error.statusCode || error.code;
          errorMessage = error.message || error.toString();
        }
      }
      
      logger.warn(`Conexión cerrada. Código: ${statusCode}, Error: ${errorMessage}`);
      
      // Decidir si reconectar basado en el código de estado
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
          default:
            logger.warn(`❓ Código de desconexión desconocido: ${statusCode}`);
        }
      } else {
        // Si no hay código de estado, probablemente sea un error de red
        logger.warn('🌐 Error de conexión de red o inicialización');
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