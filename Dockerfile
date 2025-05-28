# Usar imagen base de Node.js 18 (LTS)
FROM node:18-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema necesarias (incluyendo git)
RUN apk add --no-cache python3 make g++ wget git

# Copiar archivos de configuración de dependencias
COPY package*.json ./
COPY tsconfig.json ./

# Instalar todas las dependencias (incluidas dev para compilar)
RUN npm install

# Copiar código fuente
COPY src/ ./src/

# Compilar TypeScript
RUN npm run build

# Limpiar dependencias de desarrollo para reducir tamaño
RUN npm prune --production

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

# Comando de inicio
CMD ["node", "dist/index.js"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1