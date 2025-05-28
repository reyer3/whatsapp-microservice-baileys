# 📱 WhatsApp Microservice con Baileys

Un microservicio robusto y escalable para conectar instancias de WhatsApp usando la librería [Baileys](https://baileys.wiki/docs/intro), implementado con TypeScript, Express.js y siguiendo principios de código limpio (DRY, KISS).

## ✨ Características

- 🔌 **Conexión automática a WhatsApp** usando Baileys WebSocket
- 📤 **Envío de mensajes de texto** vía API REST
- 📥 **Recepción de mensajes** con eventos en tiempo real
- 🔐 **Autenticación con API Key** para seguridad
- 🐳 **Dockerizado** para fácil despliegue
- 📊 **Logging estructurado** con diferentes niveles
- 🔄 **Reconexión automática** en caso de desconexión
- ⚡ **Health checks** para monitoreo
- 🏗️ **Arquitectura modular** y escalable

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

1. **Construir la imagen**
```bash
docker build -t whatsapp-microservice .
```

2. **Ejecutar el contenedor**
```bash
docker run -d \
  --name whatsapp-service \
  -p 3000:3000 \
  -e API_KEY=tu-api-key-segura \
  -v $(pwd)/auth:/app/auth \
  whatsapp-microservice
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

# Configuración de seguridad
API_KEY=your-secret-api-key-here
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
    "whatsappConnected": true
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

#### `POST /api/whatsapp/connect`
Iniciar conexión a WhatsApp
```json
{
  "success": true,
  "message": "Proceso de conexión iniciado correctamente"
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

### Principios de Código Limpio Aplicados

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

## 🔒 Seguridad

- Autenticación requerida con API Key
- Headers de seguridad con Helmet
- Validación de entrada en todos los endpoints
- Usuario no-root en contenedor Docker
- Variables de entorno para configuración sensible

## 📈 Monitoreo y Logging

- Health check endpoint para monitoreo
- Logging estructurado con niveles configurables
- Métricas de uptime y estado de conexión
- Manejo graceful de señales del sistema

## 🚧 Roadmap

- [ ] Soporte para mensajes multimedia (imágenes, audio, video)
- [ ] Webhook para notificaciones de mensajes recibidos
- [ ] Métricas con Prometheus
- [ ] Tests unitarios y de integración
- [ ] Documentación con Swagger/OpenAPI
- [ ] Soporte para múltiples instancias de WhatsApp

## 🤝 Contribuir

1. Fork el proyecto
2. Crear una rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit los cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear un Pull Request

## ⚠️ Disclaimer

Este proyecto utiliza la librería Baileys que se conecta a WhatsApp Web mediante ingeniería inversa. No está afiliado ni respaldado por WhatsApp. Usar bajo tu propia responsabilidad y cumpliendo los términos de servicio de WhatsApp.

## 📄 Licencia

MIT License - ver el archivo [LICENSE](LICENSE) para más detalles.

## 📞 Soporte

Si tienes alguna pregunta o necesitas soporte:

- Crear un issue en GitHub
- Consultar la [documentación de Baileys](https://baileys.wiki/docs/intro)

---

**Desarrollado con ❤️ usando principios de código limpio y mejores prácticas**