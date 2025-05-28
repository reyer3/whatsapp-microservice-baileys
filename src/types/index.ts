import { WASocket } from 'baileys';

export interface WhatsAppConfig {
  sessionId: string;
  authFolder: string;
  printQRInTerminal: boolean;
}

export interface MessagePayload {
  to: string;
  message: string;
}

export interface IncomingMessage {
  from: string;
  message: string;
  timestamp: number;
  messageId: string;
}

export interface WhatsAppService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(payload: MessagePayload): Promise<boolean>;
  isConnected(): boolean;
  getSocket(): WASocket | null;
}

export interface APIResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  qrCode?: string;
  lastConnected?: Date;
}
