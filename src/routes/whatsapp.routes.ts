import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.middleware';
import { BaileysWhatsAppService } from '../services/whatsapp.service';

export const createWhatsAppRoutes = (whatsappService: BaileysWhatsAppService): Router => {
  const router = Router();
  const controller = new WhatsAppController(whatsappService);

  // Rutas públicas (solo para consultar estado)
  router.get('/status', optionalAuthMiddleware, controller.getStatus);

  // Rutas protegidas que requieren autenticación
  router.post('/send', authMiddleware, controller.sendMessage);
  router.post('/connect', authMiddleware, controller.connect);
  router.post('/disconnect', authMiddleware, controller.disconnect);

  return router;
};
