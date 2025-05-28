import makeWASocket, {
  DisconnectReason,
  ConnectionState,
  WASocket,
  useMultiFileAuthState,
  proto,
  WAMessage
} from 'baileys';
import qrcode from 'qrcode-terminal';
import { WhatsAppService, WhatsAppConfig, MessagePayload, IncomingMessage } from '../types';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export class BaileysWhatsAppService extends EventEmitter implements WhatsAppService {
  private socket: WASocket | null = null;
  private isConnected = false;
  private config: WhatsAppConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: WhatsAppConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      logger.info('Iniciando conexión a WhatsApp...');
      
      const { state, saveCreds } = await useMultiFileAuthState(this.config.authFolder);
      
      this.socket = makeWASocket({
        auth: state,
        printQRInTerminal: this.config.printQRInTerminal,
        logger: this.createPinoLogger(),
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
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
      this.isConnected = false;
    }
  }

  async sendMessage(payload: MessagePayload): Promise<boolean> {
    if (!this.socket || !this.isConnected) {
      throw new Error('WhatsApp no está conectado');
    }

    try {
      const jid = this.formatPhoneNumber(payload.to);
      
      await this.socket.sendMessage(jid, {
        text: payload.message
      });

      logger.info(`Mensaje enviado a ${payload.to}:`, payload.message);
      return true;
      
    } catch (error) {
      logger.error('Error al enviar mensaje:', error);
      return false;
    }
  }

  isConnected(): boolean {
    return this.isConnected;
  }

  getSocket(): WASocket | null {
    return this.socket;
  }

  private setupEventHandlers(saveCreds: () => Promise<void>): void {
    if (!this.socket) return;

    // Manejo de cambios de conexión
    this.socket.ev.on('connection.update', this.handleConnectionUpdate.bind(this));
    
    // Guardar credenciales cuando cambien
    this.socket.ev.on('creds.update', saveCreds);
    
    // Manejo de mensajes entrantes
    this.socket.ev.on('messages.upsert', this.handleIncomingMessages.bind(this));
  }

  private handleConnectionUpdate(update: Partial<ConnectionState>): void {
    const { connection, lastDisconnect, qr } = update;

    if (qr && this.config.printQRInTerminal) {
      logger.info('Código QR generado - escanear con WhatsApp');
      qrcode.generate(qr, { small: true });
      this.emit('qr', qr);
    }

    if (connection === 'close') {
      this.isConnected = false;
      
      // Verificar si fue un logout (no reconectar) o error de conexión
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      logger.warn('Conexión cerrada debido a:', lastDisconnect?.error);
      
      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        logger.info(`Intentando reconectar... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => this.connect(), 3000);
      } else {
        logger.error('Máximo número de intentos de reconexión alcanzado');
        this.emit('disconnected');
      }
    } else if (connection === 'open') {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('✅ Conectado exitosamente a WhatsApp');
      this.emit('connected');
    }
  }

  private handleIncomingMessages(m: { messages: WAMessage[]; type: proto.WebMessageInfo.StubType | undefined }): void {
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
    
    // Agregar código de país si no está presente
    if (!cleaned.startsWith('51') && cleaned.length === 9) {
      return `51${cleaned}@s.whatsapp.net`;
    }
    
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