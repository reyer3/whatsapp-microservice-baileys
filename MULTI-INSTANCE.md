# 🏢 Setup Multi-Instancia WhatsApp

Esta guía explica cómo configurar múltiples instancias de WhatsApp usando el microservicio.

## 🎯 **Casos de Uso**

- 📞 **Ventas**: Atención comercial (+51987654321)
- 🆘 **Soporte**: Atención técnica (+51987654322)  
- 📢 **Marketing**: Promociones (+51987654323)
- 👥 **Equipos**: Una instancia por departamento
- 🏪 **Sucursales**: Una instancia por ubicación

## ⚡ **Inicio Rápido**

```bash
# 1. Actualizar código
git pull origin main

# 2. Dar permisos al script
chmod +x manage-instances.sh

# 3. Ver ayuda
./manage-instances.sh help

# 4. Iniciar todas las instancias
./manage-instances.sh start

# 5. Ver estado
./manage-instances.sh status
```

## 🚀 **Comandos del Manager**

### **Gestión de Instancias**
```bash
# Iniciar instancia específica
./manage-instances.sh start ventas

# Iniciar todas
./manage-instances.sh start

# Detener instancia específica  
./manage-instances.sh stop soporte

# Reiniciar instancia
./manage-instances.sh restart marketing

# Ver estado de todas
./manage-instances.sh status
```

### **Conexión WhatsApp**
```bash
# Conectar instancia específica
./manage-instances.sh connect ventas

# Ver logs para código QR
./manage-instances.sh logs ventas

# Limpiar autenticación si hay problemas
./manage-instances.sh clean ventas
```

### **Mantenimiento**
```bash
# Ver logs en tiempo real
./manage-instances.sh logs soporte

# Reconstruir todas las imágenes
./manage-instances.sh rebuild
```

## 🌐 **Puertos y Endpoints**

| Instancia | Puerto | API Key | Endpoint |
|-----------|--------|---------|----------|
| Ventas    | 3001   | `ventas-api-key-123` | http://localhost:3001 |
| Soporte   | 3002   | `soporte-api-key-456` | http://localhost:3002 |
| Marketing | 3003   | `marketing-api-key-789` | http://localhost:3003 |

## 📱 **Configurar Nueva Instancia**

### **1. Agregar en docker-compose.multi.yml**
```yaml
whatsapp-nueva:
  build: .
  container_name: whatsapp-nueva
  ports:
    - "3004:3000"
  environment:
    - API_KEY=nueva-api-key-000
    - WHATSAPP_SESSION_ID=nueva-session
    - WHATSAPP_INSTANCE_NAME=Nueva
    - WHATSAPP_PHONE_NUMBER=+51987654324
  volumes:
    - nueva_auth:/app/auth
```

### **2. Agregar volumen**
```yaml
volumes:
  nueva_auth:
    driver: local
```

### **3. Actualizar script manage-instances.sh**
Agregar "nueva" a las funciones `get_port()` y `get_api_key()`

## 🔐 **Configuración de Seguridad**

### **Variables de Entorno (.env.multi)**
```env
# API Keys únicas por instancia
API_KEY_VENTAS=ventas-super-secret-key-123
API_KEY_SOPORTE=soporte-super-secret-key-456  
API_KEY_MARKETING=marketing-super-secret-key-789

# Números de teléfono
WHATSAPP_PHONE_VENTAS=+51987654321
WHATSAPP_PHONE_SOPORTE=+51987654322
WHATSAPP_PHONE_MARKETING=+51987654323
```

### **Separación de Credenciales**
- ✅ **Volúmenes independientes** por instancia
- ✅ **API Keys únicas** para cada servicio
- ✅ **Autenticación aislada** (no se mezclan sesiones)
- ✅ **Logs separados** por instancia

## 🧪 **Proceso de Conexión Completo**

### **Ejemplo: Conectar Instancia de Ventas**

```bash
# 1. Iniciar instancia
./manage-instances.sh start ventas

# 2. Verificar que esté corriendo
./manage-instances.sh status

# 3. Conectar a WhatsApp
./manage-instances.sh connect ventas

# 4. Ver logs para código QR
./manage-instances.sh logs ventas

# 5. Escanear QR con teléfono de ventas (+51987654321)

# 6. Verificar conexión
curl -H "x-api-key: ventas-api-key-123" \
     http://localhost:3001/api/whatsapp/status
```

### **Enviar Mensaje de Prueba**
```bash
curl -X POST -H "x-api-key: ventas-api-key-123" \
     -H "Content-Type: application/json" \
     -d '{"to":"51987654321","message":"Hola desde Ventas!"}' \
     http://localhost:3001/api/whatsapp/send
```

## 📊 **Monitoreo Multi-Instancia**

### **Dashboard de Estado**
```bash
# Ver estado general
./manage-instances.sh status

# Healthcheck de todas las instancias
for port in 3001 3002 3003; do
  echo "Puerto $port:"
  curl -s http://localhost:$port/health | jq '.data.whatsappConnected'
done
```

### **Logs Centralizados**
```bash
# Ver logs de todas las instancias
docker compose -f docker-compose.multi.yml logs -f

# Ver logs de instancia específica  
docker compose -f docker-compose.multi.yml logs -f whatsapp-ventas
```

## 🔄 **Escalamiento**

### **Límites Recomendados**
- **Por servidor**: 3-5 instancias máximo
- **RAM**: ~512MB por instancia
- **CPU**: 0.5 cores por instancia
- **Disco**: ~100MB por instancia para logs/auth

### **Escalamiento Horizontal**
```bash
# Servidor 1: Ventas + Soporte
docker compose -f docker-compose.multi.yml up -d whatsapp-ventas whatsapp-soporte

# Servidor 2: Marketing + Otras
docker compose -f docker-compose.multi.yml up -d whatsapp-marketing
```

## 🚨 **Troubleshooting Multi-Instancia**

### **Problema: Puerto ya en uso**
```bash
# Ver qué usa el puerto
sudo netstat -tlnp | grep :3001

# Cambiar puerto en docker-compose.multi.yml
```

### **Problema: Instancias se desconectan**
```bash
# Limpiar autenticación de instancia específica
./manage-instances.sh clean ventas

# Reiniciar instancia
./manage-instances.sh restart ventas

# Reconectar
./manage-instances.sh connect ventas
```

### **Problema: Recursos insuficientes**
```bash
# Ver uso de recursos
docker stats

# Limitar recursos por instancia en docker-compose.multi.yml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: '0.5'
```

## 📈 **Métricas y Analytics**

### **Endpoint de Métricas por Instancia**
```bash
# Estado de todas las instancias
curl -s http://localhost:3001/health | jq '.data.whatsappConnected'
curl -s http://localhost:3002/health | jq '.data.whatsappConnected'  
curl -s http://localhost:3003/health | jq '.data.whatsappConnected'
```

### **Script de Monitoreo Automático**
```bash
#!/bin/bash
# monitor-all.sh
for instance in ventas soporte marketing; do
  port=$(./manage-instances.sh get_port $instance)
  status=$(curl -s http://localhost:$port/health | jq -r '.data.whatsappConnected')
  echo "$instance: $status"
done
```

## 🎛️ **Gestión Avanzada**

### **Backup de Configuraciones**
```bash
# Backup de autenticación por instancia
docker cp whatsapp-ventas:/app/auth ./backup/ventas-auth
docker cp whatsapp-soporte:/app/auth ./backup/soporte-auth
```

### **Restore de Configuraciones**
```bash
# Restore de autenticación
docker cp ./backup/ventas-auth whatsapp-ventas:/app/auth
./manage-instances.sh restart ventas
```

### **Logging Centralizado**
```bash
# Enviar logs a sistema externo (ej: ELK Stack)
docker compose -f docker-compose.multi.yml logs --no-color | \
  filebeat -e
```

---

**🎯 Con este setup puedes manejar múltiples números de WhatsApp de forma independiente y escalable**