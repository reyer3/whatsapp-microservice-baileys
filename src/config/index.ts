import dotenv from 'dotenv';
import { WhatsAppConfig } from '../types';

// Cargar variables de entorno
dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    apiKey: process.env.API_KEY || 'default-api-key'
  },
  
  whatsapp: {
    sessionId: process.env.WHATSAPP_SESSION_ID || 'whatsapp-session',
    authFolder: process.env.WHATSAPP_AUTH_FOLDER || './auth',
    printQRInTerminal: process.env.NODE_ENV !== 'production'
  } as WhatsAppConfig,
  
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

export const isDevelopment = config.server.nodeEnv === 'development';
export const isProduction = config.server.nodeEnv === 'production';
