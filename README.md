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
- 🔍 **Herramientas de diagnóstico** integradas

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 17 o superior
- npm o yarn
- Docker (opcional)

### Instalación con Docker (Recomendado)

```bash
# Clonar y actualizar
git clone https://github.com/reyer3/whatsapp-microservice-baileys.git
cd whatsapp-microservice-baileys
git pull origin main

# Iniciar servicio
docker-compose up -d

# Ver logs
docker-compose logs -f whatsapp-microservice
```

### 🔍 Diagnóstico y Solución de Problemas

Si el servicio no se conecta automáticamente, sigue estos pasos:

#### 1. **Verificar Estado del Servicio**
```bash
curl http://localhost:3000/health
```

#### 2. **Ejecutar Diagnóstico Completo**
```bash
curl -H "x-api-key: test-api-key-change-in-production" \
     http://localhost:3000/api/whatsapp/diagnostics
```

#### 3. **Limpiar Autenticación (si es necesario)**
```bash
# Solo si hay problemas de sesión
curl -X POST -H "x-api-key: test-api-key-change-in-production" \
     http://localhost:3000/api/whatsapp/clean-auth
```

#### 4. **Conectar Manualmente**
```bash
# Iniciar conexión
curl -X POST -H "x-api-key: test-api-key-change-in-production" \
     http://localhost:3000/api/whatsapp/connect

# Ver logs para código QR
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
LOG_LEVEL=debug

# IMPORTANTE: Cambiar esta API key por una segura en producción
API_KEY=test-api-key-change-in-production
```

## 🔌 API Endpoints

### Autenticación
Todas las rutas protegidas requieren el header:
```
x-api-key: tu-api-key
```

### Endpoints Principales

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

#### `GET /api/whatsapp/diagnostics` 🆕
Diagnóstico completo del sistema
```json
{
  "success": true,
  "data": {
    "service": {
      "connected": false,
      "socketExists": false
    },
    "authentication": {
      "folderExists": true,
      "folderPath": "/app/auth",
      "filesCount": 3,
      "files": ["creds.json", "keys.json", "session.json"],
      "hasCredentials": true,
      "hasKeys": true
    },
    "environment": {
      "nodeEnv": "development",
      "logLevel": "debug",
      "authFolder": "/app/auth"
    }
  }
}
```

#### `POST /api/whatsapp/clean-auth` 🆕
Limpiar archivos de autenticación
```json
{
  "success": true,
  "message": "Archivos de autenticación limpiados correctamente (3 archivos eliminados)",
  "data": { "filesRemoved": 3 }
}
```

#### `GET /api/whatsapp/status`
Obtener estado de conexión
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
Conectar a WhatsApp (genera QR code)
```json
{
  "success": true,
  "message": "Proceso de conexión iniciado correctamente"
}
```

#### `POST /api/whatsapp/pairing-code`
Generar código de emparejamiento
```json
{
  "phoneNumber": "51987654321"
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

## 🛠️ Solución de Problemas Comunes

### ❌ **Problema: Conexión falla constantemente**
**Síntomas:** Logs muestran "Código: undefined" y reconexiones fallidas

**Solución:**
1. Verificar diagnóstico: `GET /api/whatsapp/diagnostics`
2. Limpiar autenticación: `POST /api/whatsapp/clean-auth`
3. Conectar manualmente: `POST /api/whatsapp/connect`

### ❌ **Problema: No aparece código QR**
**Síntomas:** Se conecta pero no muestra QR en logs

**Solución:**
```bash
# Verificar si socket está inicializado
curl -H "x-api-key: test-api-key-change-in-production" \
     http://localhost:3000/api/whatsapp/diagnostics

# Si no está inicializado, limpiar y reconectar
curl -X POST -H "x-api-key: test-api-key-change-in-production" \
     http://localhost:3000/api/whatsapp/clean-auth

curl -X POST -H "x-api-key: test-api-key-change-in-production" \
     http://localhost:3000/api/whatsapp/connect
```

### ❌ **Problema: Error de sesión inválida**
**Síntomas:** Logs muestran "badSession" o "Sesión inválida"

**Solución:**
```bash
# Limpiar completamente la autenticación
curl -X POST -H "x-api-key: test-api-key-change-in-production" \
     http://localhost:3000/api/whatsapp/clean-auth

# Reiniciar contenedor
docker-compose restart whatsapp-microservice

# Conectar nuevamente
curl -X POST -H "x-api-key: test-api-key-change-in-production" \
     http://localhost:3000/api/whatsapp/connect
```

### ❌ **Problema: Archivos de autenticación no persisten**
**Síntomas:** Siempre pide QR/código nuevamente

**Solución:**
```bash
# Verificar volúmenes de Docker
docker volume ls | grep whatsapp

# Verificar permisos
docker-compose exec whatsapp-microservice ls -la /app/auth

# Si es necesario, recrear volúmenes
docker-compose down -v
docker-compose up -d
```

## 🔧 Scripts de Diagnóstico Rápido

### Script de Diagnóstico Completo
```bash
#!/bin/bash
echo "=== Diagnóstico WhatsApp Microservice ==="
echo "1. Health Check:"
curl -s http://localhost:3000/health | jq '.data.whatsappConnected'

echo -e "\n2. Diagnóstico Completo:"
curl -s -H "x-api-key: test-api-key-change-in-production" \
     http://localhost:3000/api/whatsapp/diagnostics | jq '.'

echo -e "\n3. Logs recientes:"
docker-compose logs --tail=10 whatsapp-microservice
```

### Script de Reinicio Limpio
```bash
#!/bin/bash
echo "=== Reinicio Limpio WhatsApp Microservice ==="
echo "1. Limpiando autenticación..."
curl -X POST -H "x-api-key: test-api-key-change-in-production" \
     http://localhost:3000/api/whatsapp/clean-auth

echo -e "\n2. Reiniciando servicio..."
docker-compose restart whatsapp-microservice

echo -e "\n3. Esperando 5 segundos..."
sleep 5

echo -e "\n4. Conectando..."
curl -X POST -H "x-api-key: test-api-key-change-in-production" \
     http://localhost:3000/api/whatsapp/connect

echo -e "\n5. Ver logs para código QR:"
echo "docker-compose logs -f whatsapp-microservice"
```

## 📈 Monitoreo Avanzado

### Comandos de Monitoreo
```bash
# Estado en tiempo real
watch -n 5 'curl -s http://localhost:3000/health | jq ".data.whatsappConnected"'

# Logs en tiempo real con filtro
docker-compose logs -f whatsapp-microservice | grep -E "(QR|conectado|error)"

# Estadísticas del contenedor
docker stats whatsapp-microservice
```

## ⚠️ Consideraciones de Producción

### 🚨 **IMPORTANTE - Sistema de Autenticación**
El proyecto actualmente usa `useMultiFileAuthState` que **NO ES RECOMENDADO PARA PRODUCCIÓN**.

**Para producción debes implementar:**
- Sistema de autenticación con base de datos (SQL/NoSQL/Redis)
- Almacenamiento seguro de credenciales
- Gestión adecuada de sesiones

## 🤝 Contribuir

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## ⚠️ Disclaimer

Este proyecto utiliza Baileys que se conecta a WhatsApp Web mediante ingeniería inversa. No está afiliado ni respaldado por WhatsApp. Usar bajo tu propia responsabilidad y cumpliendo los términos de servicio de WhatsApp.

## 📄 Licencia

MIT License - ver el archivo [LICENSE](LICENSE) para más detalles.

---

**Desarrollado con ❤️ usando principios de código limpio y mejores prácticas oficiales de Baileys**