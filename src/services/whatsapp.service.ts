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
  private connected = false; // Cambié el nombre para evitar conflicto
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
      
      const { state, saveCreds } = await useMultiFileAuthState(this.config.authFolder);
      
      this.socket = makeWASocket({
        auth: state,
        browser: Browsers.macOS('WhatsApp Microservice'),
        logger: this.createPinoLogger(),
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: false, // Evitar marcar como online automáticamente
        getMessage: this.getMessage.bind(this),
        printQRInTerminal: false, // Manejamos QR manualmente
        defaultQueryTimeoutMs: 60000,
      });

      this.setupEventHandlers(saveCreds);
      
    } catch (error) {
      logger.error('Error al conectar con WhatsApp:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      logger.info('Desconectando de WhatsApp...');
      this.socket.end(new Error('Desconexión solicitada'));
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

  // Método público para verificar conexión
  isConnected(): boolean {
    return this.connected;
  }

  getSocket(): WASocket | null {
    return this.socket;
  }

  // Implementación requerida por Baileys para reenvío de mensajes
  private async getMessage(key: proto.IMessageKey): Promise<proto.IMessage | undefined> {
    if (!key.id) return undefined;
    
    const message = this.messageStore.get(key.id);
    return message?.message || undefined;
  }

  private setupEventHandlers(saveCreds: () => Promise<void>): void {
    if (!this.socket) return;

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
  }

  private handleConnectionUpdate(update: Partial<ConnectionState>): void {
    const { connection, lastDisconnect, qr } = update;

    // Manejar código QR
    if (qr) {
      logger.info('Código QR generado - escanear con WhatsApp');
      if (this.config.printQRInTerminal) {
        qrcode.generate(qr, { small: true });
      }
      this.emit('qr', qr);
    }

    // Manejar conexión cerrada
    if (connection === 'close') {
      this.connected = false;
      
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      logger.warn(`Conexión cerrada. Código: ${statusCode}`, lastDisconnect?.error);
      
      // Mapear códigos de desconexión para mejor diagnóstico
      switch (statusCode) {
        case DisconnectReason.badSession:
          logger.error('Sesión inválida. Eliminar archivos de autenticación.');
          break;
        case DisconnectReason.connectionClosed:
          logger.warn('Conexión cerrada por el servidor.');
          break;
        case DisconnectReason.connectionLost:
          logger.warn('Conexión perdida.');
          break;
        case DisconnectReason.connectionReplaced:
          logger.warn('Conexión reemplazada por otra sesión.');
          break;
        case DisconnectReason.loggedOut:
          logger.warn('Sesión cerrada por el usuario.');
          break;
        case DisconnectReason.restartRequired:
          logger.info('Reinicio requerido.');
          break;
        case DisconnectReason.timedOut:
          logger.warn('Tiempo de conexión agotado.');
          break;
        default:
          logger.warn(`Desconexión desconocida: ${statusCode}`);
      }
      
      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        logger.info(`Intentando reconectar... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => this.connect(), 3000);
      } else {
        logger.error('Máximo número de intentos de reconexión alcanzado');
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
      if (message.key.fromMe) continue; // Ignorar mensajes propios

      const incomingMessage = this.parseIncomingMessage(message);
      if (incomingMessage) {
        logger.info(`Mensaje recibido de ${incomingMessage.from}:`, incomingMessage.message);
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
    // Remover caracteres no numéricos
    const cleaned = phone.replace(/\D/g, '');
    
    // Validar formato E.164 sin + (según documentación de Baileys)
    if (cleaned.length < 10) {
      throw new Error('Número de teléfono demasiado corto');
    }
    
    // Agregar código de país de Perú si no está presente
    if (!cleaned.startsWith('51') && cleaned.length === 9) {
      return `51${cleaned}@s.whatsapp.net`;
    }
    
    // Si ya tiene código de país, usar tal como está
    return `${cleaned}@s.whatsapp.net`;
  }

  private createPinoLogger() {
    return {
      level: 'silent', // Silenciar logs de Baileys para usar nuestro logger
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