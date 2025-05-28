import { Request, Response } from 'express';
import { BaileysWhatsAppService } from '../services/whatsapp.service';
import { APIResponse, MessagePayload, ConnectionStatus } from '../types';
import { logger } from '../utils/logger';

export class WhatsAppController {
  constructor(private whatsappService: BaileysWhatsAppService) {}

  // Obtener estado de conexión
  getStatus = (req: Request, res: Response): void => {
    try {
      const status: ConnectionStatus = {
        connected: this.whatsappService.isConnected(),
        lastConnected: this.whatsappService.isConnected() ? new Date() : undefined
      };

      const response: APIResponse<ConnectionStatus> = {
        success: true,
        message: 'Estado de conexión obtenido correctamente',
        data: status
      };

      res.json(response);
    } catch (error) {
      logger.error('Error al obtener estado:', error);
      this.sendErrorResponse(res, 'Error al obtener estado de conexión');
    }
  };

  // Enviar mensaje
  sendMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { to, message }: MessagePayload = req.body;

      // Validaciones
      if (!to || !message) {
        const response: APIResponse = {
          success: false,
          message: 'Los campos "to" y "message" son requeridos',
          error: 'Datos faltantes'
        };
        res.status(400).json(response);
        return;
      }

      if (!this.whatsappService.isConnected()) {
        const response: APIResponse = {
          success: false,
          message: 'WhatsApp no está conectado',
          error: 'Sin conexión'
        };
        res.status(503).json(response);
        return;
      }

      const success = await this.whatsappService.sendMessage({ to, message });

      if (success) {
        const response: APIResponse = {
          success: true,
          message: 'Mensaje enviado correctamente',
          data: { to, message, timestamp: new Date() }
        };
        res.json(response);
      } else {
        this.sendErrorResponse(res, 'Error al enviar mensaje', 500);
      }

    } catch (error) {
      logger.error('Error al enviar mensaje:', error);
      this.sendErrorResponse(res, 'Error interno al enviar mensaje');
    }
  };

  // Conectar/Reconectar WhatsApp
  connect = async (req: Request, res: Response): Promise<void> => {
    try {
      if (this.whatsappService.isConnected()) {
        const response: APIResponse = {
          success: true,
          message: 'WhatsApp ya está conectado'
        };
        res.json(response);
        return;
      }

      await this.whatsappService.connect();
      
      const response: APIResponse = {
        success: true,
        message: 'Proceso de conexión iniciado correctamente'
      };
      res.json(response);

    } catch (error) {
      logger.error('Error al conectar:', error);
      this.sendErrorResponse(res, 'Error al iniciar conexión');
    }
  };

  // Desconectar WhatsApp
  disconnect = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.whatsappService.disconnect();
      
      const response: APIResponse = {
        success: true,
        message: 'Desconectado de WhatsApp correctamente'
      };
      res.json(response);

    } catch (error) {
      logger.error('Error al desconectar:', error);
      this.sendErrorResponse(res, 'Error al desconectar');
    }
  };

  private sendErrorResponse(res: Response, message: string, statusCode = 500): void {
    const response: APIResponse = {
      success: false,
      message,
      error: 'Error interno del servidor'
    };
    res.status(statusCode).json(response);
  }
}
