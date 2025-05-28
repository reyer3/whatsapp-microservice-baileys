# Usar imagen base de Node.js 18 (LTS)
FROM node:18-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache python3 make g++

# Copiar archivos de configuración de dependencias
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY src/ ./src/

# Compilar TypeScript
RUN npm run build

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S whatsapp -u 1001

# Crear directorio para archivos de autenticación
RUN mkdir -p /app/auth && chown -R whatsapp:nodejs /app/auth

# Cambiar al usuario no-root
USER whatsapp

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000
ENV WHATSAPP_AUTH_FOLDER=/app/auth

# Comando de inicio
CMD ["node", "dist/index.js"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"
