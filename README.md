# 📱 WhatsApp Microservice con Baileys

Un microservicio robusto y escalable para conectar instancias de WhatsApp usando la librería [Baileys](https://baileys.wiki/docs/intro), implementado con TypeScript, Express.js y siguiendo principios de código limpio (DRY, KISS) y las mejores prácticas oficiales de Baileys.

## ✨ Características

- 🔌 **Conexión automática a WhatsApp** usando Baileys WebSocket
- 📤 **Envío de mensajes de texto** vía API REST
- 📥 **Recepción de mensajes** con eventos en tiempo real
- 🔐 **Autenticación con API Key** para seguridad
- 📱 **Doble método de conexión**: QR Code + Código de emparejamiento
- 🐳 **Dockerizado** para fácil despliegue
- 📊 **Logging estructurado** con diferentes niveles
- 🔄 **Reconexión automática** inteligente
- ⚡ **Health checks** para monitoreo
- 🏗️ **Arquitectura modular** y escalable
- 🛡️ **Implementación de getMessage** para reenvío de mensajes
- 📝 **Validaciones robustas** de entrada

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 17 o superior
- npm o yarn
- Docker (opcional)

### Instalación Local

1. **Clonar el repositorio**
```bash
git clone https://github.com/reyer3/whatsapp-microservice-baileys.git
cd whatsapp-microservice-baileys
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
# Editar .env con tu configuración
```

4. **Compilar y ejecutar**
```bash
npm run build
npm start
```

O en modo desarrollo:
```bash
npm run dev
```

### 🐳 Usando Docker

1. **Actualizar y construir**
```bash
git pull origin main
docker-compose down
docker-compose up -d
```

2. **Ver logs del servicio**
```bash
docker-compose logs -f whatsapp-microservice
```

## 📋 Variables de Entorno

```env
# Configuración del servidor
PORT=3000
NODE_ENV=development

# Configuración de WhatsApp
WHATSAPP_SESSION_ID=whatsapp-session
WHATSAPP_AUTH_FOLDER=./auth

# Configuración de logging
LOG_LEVEL=info

# IMPORTANTE: Cambiar esta API key por una segura en producción
API_KEY=test-api-key-change-in-production
```

## 🔌 API Endpoints

### Autenticación
Todas las rutas protegidas requieren el header:
```
x-api-key: tu-api-key
```

### Endpoints Disponibles

#### `GET /health`
Health check del servicio
```json
{
  "success": true,
  "message": "Servicio funcionando correctamente",
  "data": {
    "status": "healthy",
    "timestamp": "2025-05-28T16:30:00.000Z",
    "uptime": 3600,
    "whatsappConnected": true,
    "version": "1.0.0"
  }
}
```

#### `GET /api/whatsapp/status`
Obtener estado de conexión de WhatsApp
```json
{
  "success": true,
  "message": "Estado de conexión obtenido correctamente",
  "data": {
    "connected": true,
    "lastConnected": "2025-05-28T16:30:00.000Z"
  }
}
```

#### `POST /api/whatsapp/connect`
Iniciar conexión a WhatsApp (genera QR code)
```json
{
  "success": true,
  "message": "Proceso de conexión iniciado correctamente"
}
```

#### `POST /api/whatsapp/pairing-code` ⭐ **NUEVO**
Generar código de emparejamiento (alternativa al QR)
```json
{
  "phoneNumber": "51987654321"
}
```

Respuesta:
```json
{
  "success": true,
  "message": "Código de emparejamiento generado correctamente",
  "data": {
    "phoneNumber": "51987654321",
    "pairingCode": "ABC123",
    "expiresIn": "3 minutos",
    "instructions": "Ingresa este código en WhatsApp > Dispositivos vinculados > Vincular dispositivo"
  }
}
```

#### `POST /api/whatsapp/send`
Enviar mensaje de texto
```json
{
  "to": "51987654321",
  "message": "Hola desde el microservicio!"
}
```

Respuesta:
```json
{
  "success": true,
  "message": "Mensaje enviado correctamente",
  "data": {
    "to": "51987654321",
    "message": "Hola desde el microservicio!",
    "timestamp": "2025-05-28T16:30:00.000Z"
  }
}
```

#### `POST /api/whatsapp/disconnect`
Desconectar de WhatsApp
```json
{
  "success": true,
  "message": "Desconectado de WhatsApp correctamente"
}
```

## 📱 Métodos de Conexión

### 1. Código QR (Tradicional)
```bash
# 1. Conectar y generar QR
curl -X POST -H "x-api-key: test-api-key-change-in-production" \
     http://localhost:3000/api/whatsapp/connect

# 2. Ver QR en los logs
docker-compose logs -f whatsapp-microservice

# 3. Escanear QR con WhatsApp
```

### 2. Código de Emparejamiento (Nuevo)
```bash
# 1. Conectar servicio
curl -X POST -H "x-api-key: test-api-key-change-in-production" \
     http://localhost:3000/api/whatsapp/connect

# 2. Generar código para tu número
curl -X POST -H "x-api-key: test-api-key-change-in-production" \
     -H "Content-Type: application/json" \
     -d '{"phoneNumber":"51987654321"}' \
     http://localhost:3000/api/whatsapp/pairing-code

# 3. Usar código en WhatsApp > Dispositivos vinculados > Vincular dispositivo
```

## 🏗️ Arquitectura del Proyecto

```
src/
├── config/           # Configuración centralizada
├── controllers/      # Controladores de API REST
├── middleware/       # Middlewares (auth, logging, etc.)
├── routes/          # Definición de rutas
├── services/        # Lógica de negocio (WhatsApp)
├── types/           # Interfaces y tipos TypeScript
├── utils/           # Utilidades (logger, helpers)
├── server.ts        # Configuración del servidor Express
└── index.ts         # Punto de entrada principal
```

### Mejores Prácticas Implementadas

#### **Según Documentación Oficial de Baileys:**
- ✅ **Función getMessage implementada** para reenvío de mensajes
- ✅ **Manejo inteligente de códigos de desconexión**
- ✅ **Configuración optimizada del socket**
- ✅ **Soporte para códigos de emparejamiento**
- ✅ **Logger personalizado** (no usar el de Baileys)
- ⚠️ **Advertencia sobre useMultiFileAuthState en producción**

#### **Principios de Código Limpio:**
- **DRY (Don't Repeat Yourself)**: Configuración centralizada, servicios reutilizables
- **KISS (Keep It Simple, Stupid)**: Interfaces claras, responsabilidades bien definidas
- **Separación de responsabilidades**: Cada módulo tiene una función específica
- **Inyección de dependencias**: Servicios desacoplados y testeable

## 📡 Eventos del Sistema

El servicio emite los siguientes eventos internos:

- `connected`: WhatsApp conectado exitosamente
- `disconnected`: WhatsApp desconectado
- `qr`: Código QR generado para conexión
- `message`: Nuevo mensaje recibido

## 🔧 Scripts Disponibles

```bash
npm run dev          # Modo desarrollo con hot-reload
npm run build        # Compilar TypeScript
npm start            # Ejecutar en producción
npm run clean        # Limpiar archivos compilados
```

## 📦 Dependencias Principales

- **baileys**: Librería para WhatsApp Web API
- **express**: Framework web
- **typescript**: Lenguaje de programación tipado
- **helmet**: Seguridad para Express
- **cors**: Manejo de CORS
- **morgan**: Logging de requests HTTP
- **dotenv**: Manejo de variables de entorno
- **qrcode-terminal**: Generación de QR en terminal

## 🔒 Seguridad

- Autenticación requerida con API Key
- Headers de seguridad con Helmet
- Validación de entrada en todos los endpoints
- Usuario no-root en contenedor Docker
- Variables de entorno para configuración sensible
- Validación de formato E.164 para números de teléfono

## 📈 Monitoreo y Logging

- Health check endpoint para monitoreo
- Logging estructurado con niveles configurables
- Métricas de uptime y estado de conexión
- Manejo graceful de señales del sistema
- Códigos de error detallados de Baileys

## ⚠️ Consideraciones de Producción

### 🚨 **IMPORTANTE - Sistema de Autenticación**
El proyecto actualmente usa `useMultiFileAuthState` que **NO ES RECOMENDADO PARA PRODUCCIÓN** según la documentación oficial de Baileys.

**Para producción debes implementar:**
- Sistema de autenticación con base de datos (SQL/NoSQL/Redis)
- Almacenamiento seguro de credenciales
- Gestión adecuada de sesiones

### 📝 **Ejemplo de Implementación Personalizada:**
```typescript
// Implementar AuthenticationState personalizado
const customAuthState: AuthenticationState = {
  creds: await getCredsFromDatabase(),
  keys: await getKeysFromDatabase()
};

const sock = makeWASocket({ 
  auth: customAuthState,
  // ... otras configuraciones
});

sock.ev.on('creds.update', async (creds) => {
  await saveCredsToDatabase(creds);
});
```

## 🚧 Roadmap

- [ ] Sistema de autenticación para producción (SQL/Redis)
- [ ] Soporte para mensajes multimedia (imágenes, audio, video)
- [ ] Webhook para notificaciones de mensajes recibidos
- [ ] Métricas con Prometheus
- [ ] Tests unitarios y de integración
- [ ] Documentación con Swagger/OpenAPI
- [ ] Soporte para múltiples instancias de WhatsApp
- [ ] Cache para metadatos de grupos
- [ ] Rate limiting inteligente

## 🛠️ Solución de Problemas

### Error de Git en Docker
**Síntoma:** `npm error enoent An unknown git error occurred`
**Solución:** ✅ Corregido - agregado `git` a las dependencias del Dockerfile

### Advertencias de Producción
**Síntoma:** Advertencias sobre `useMultiFileAuthState`
**Solución:** Implementar sistema de auth personalizado con BD

### Problemas de Conexión
```bash
# Ver logs detallados
docker-compose logs -f whatsapp-microservice

# Reiniciar servicio
docker-compose restart whatsapp-microservice

# Limpiar datos de auth (si es necesario)
docker-compose down
docker volume rm whatsapp-microservice-baileys_auth_data
docker-compose up -d
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crear una rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit los cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear un Pull Request

## ⚠️ Disclaimer

Este proyecto utiliza la librería Baileys que se conecta a WhatsApp Web mediante ingeniería inversa. No está afiliado ni respaldado por WhatsApp. Usar bajo tu propia responsabilidad y cumpliendo los términos de servicio de WhatsApp.

**Recomendaciones:**
- No usar para spam o mensajes masivos
- Respetar la privacidad de los usuarios
- Cumplir con las políticas de WhatsApp
- Usar solo para propósitos legítimos

## 📄 Licencia

MIT License - ver el archivo [LICENSE](LICENSE) para más detalles.

## 📞 Soporte

Si tienes alguna pregunta o necesitas soporte:

- Crear un issue en GitHub
- Consultar la [documentación de Baileys](https://baileys.wiki/docs/intro)
- Revisar la [configuración oficial](https://baileys.wiki/docs/socket/configuration)

---

**Desarrollado con ❤️ usando principios de código limpio y mejores prácticas oficiales de Baileys**