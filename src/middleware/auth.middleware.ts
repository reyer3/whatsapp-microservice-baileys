import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { APIResponse } from '../types';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  isAuthenticated?: boolean;
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      const response: APIResponse = {
        success: false,
        message: 'API key requerida',
        error: 'Sin autorización'
      };
      res.status(401).json(response);
      return;
    }

    if (apiKey !== config.server.apiKey) {
      logger.warn('Intento de acceso con API key inválida:', { apiKey });
      const response: APIResponse = {
        success: false,
        message: 'API key inválida',
        error: 'No autorizado'
      };
      res.status(403).json(response);
      return;
    }

    req.isAuthenticated = true;
    next();

  } catch (error) {
    logger.error('Error en middleware de autenticación:', error);
    const response: APIResponse = {
      success: false,
      message: 'Error de autenticación',
      error: 'Error interno'
    };
    res.status(500).json(response);
  }
};

export const optionalAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (apiKey && apiKey === config.server.apiKey) {
    req.isAuthenticated = true;
  }
  
  next();
};
