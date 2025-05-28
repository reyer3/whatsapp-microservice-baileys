#!/bin/bash

# Script de Gestión Multi-Instancia WhatsApp
# Uso: ./manage-instances.sh [comando] [instancia]

set -e

COMPOSE_FILE="docker-compose.multi.yml"
ENV_FILE=".env.multi"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar ayuda
show_help() {
    echo -e "${BLUE}🚀 WhatsApp Multi-Instance Manager${NC}"
    echo ""
    echo "Uso: $0 [comando] [instancia]"
    echo ""
    echo "Comandos:"
    echo "  start [instancia]     - Iniciar instancia específica o todas"
    echo "  stop [instancia]      - Detener instancia específica o todas"
    echo "  restart [instancia]   - Reiniciar instancia específica o todas"
    echo "  logs [instancia]      - Ver logs de instancia específica"
    echo "  status               - Ver estado de todas las instancias"
    echo "  connect [instancia]  - Conectar instancia a WhatsApp"
    echo "  clean [instancia]    - Limpiar autenticación de instancia"
    echo "  rebuild              - Reconstruir todas las imágenes"
    echo ""
    echo "Instancias disponibles:"
    echo "  ventas      - Puerto 3001"
    echo "  soporte     - Puerto 3002" 
    echo "  marketing   - Puerto 3003"
    echo ""
    echo "Ejemplos:"
    echo "  $0 start ventas              # Iniciar solo instancia de ventas"
    echo "  $0 logs soporte              # Ver logs de soporte"
    echo "  $0 connect marketing         # Conectar marketing a WhatsApp"
    echo "  $0 status                    # Ver estado de todas"
}

# Verificar que existe el archivo de configuración
check_config() {
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        echo -e "${RED}❌ Error: No se encontró $COMPOSE_FILE${NC}"
        exit 1
    fi
    
    if [[ ! -f "$ENV_FILE" ]]; then
        echo -e "${YELLOW}⚠️  Advertencia: No se encontró $ENV_FILE, usando valores por defecto${NC}"
    fi
}

# Obtener puerto de instancia
get_port() {
    case $1 in
        ventas) echo "3001" ;;
        soporte) echo "3002" ;;
        marketing) echo "3003" ;;
        *) echo "3000" ;;
    esac
}

# Obtener API key de instancia  
get_api_key() {
    case $1 in
        ventas) echo "ventas-api-key-123" ;;
        soporte) echo "soporte-api-key-456" ;;
        marketing) echo "marketing-api-key-789" ;;
        *) echo "default-api-key" ;;
    esac
}

# Función para iniciar instancias
start_instances() {
    local instance=$1
    check_config
    
    if [[ -n "$instance" ]]; then
        echo -e "${GREEN}🚀 Iniciando instancia: whatsapp-$instance${NC}"
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d "whatsapp-$instance"
    else
        echo -e "${GREEN}🚀 Iniciando todas las instancias${NC}"
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    fi
}

# Función para detener instancias
stop_instances() {
    local instance=$1
    check_config
    
    if [[ -n "$instance" ]]; then
        echo -e "${YELLOW}🛑 Deteniendo instancia: whatsapp-$instance${NC}"
        docker compose -f "$COMPOSE_FILE" stop "whatsapp-$instance"
    else
        echo -e "${YELLOW}🛑 Deteniendo todas las instancias${NC}"
        docker compose -f "$COMPOSE_FILE" down
    fi
}

# Función para reiniciar instancias
restart_instances() {
    local instance=$1
    check_config
    
    if [[ -n "$instance" ]]; then
        echo -e "${BLUE}🔄 Reiniciando instancia: whatsapp-$instance${NC}"
        docker compose -f "$COMPOSE_FILE" restart "whatsapp-$instance"
    else
        echo -e "${BLUE}🔄 Reiniciando todas las instancias${NC}"
        docker compose -f "$COMPOSE_FILE" restart
    fi
}

# Función para ver logs
show_logs() {
    local instance=$1
    check_config
    
    if [[ -n "$instance" ]]; then
        echo -e "${BLUE}📋 Logs de instancia: whatsapp-$instance${NC}"
        docker compose -f "$COMPOSE_FILE" logs -f "whatsapp-$instance"
    else
        echo -e "${BLUE}📋 Logs de todas las instancias${NC}"
        docker compose -f "$COMPOSE_FILE" logs -f
    fi
}

# Función para ver estado
show_status() {
    check_config
    echo -e "${BLUE}📊 Estado de las instancias${NC}"
    docker compose -f "$COMPOSE_FILE" ps
    
    echo ""
    echo -e "${BLUE}🌐 Endpoints disponibles:${NC}"
    
    for instance in ventas soporte marketing; do
        port=$(get_port "$instance")
        container_name="whatsapp-$instance"
        
        if docker compose -f "$COMPOSE_FILE" ps "$container_name" | grep -q "Up"; then
            status="${GREEN}✅ Online${NC}"
        else
            status="${RED}❌ Offline${NC}"
        fi
        
        echo -e "  $instance: http://localhost:$port ($status)"
    done
}

# Función para conectar instancia
connect_instance() {
    local instance=$1
    
    if [[ -z "$instance" ]]; then
        echo -e "${RED}❌ Error: Especifica la instancia (ventas/soporte/marketing)${NC}"
        exit 1
    fi
    
    local port=$(get_port "$instance")
    local api_key=$(get_api_key "$instance")
    
    echo -e "${GREEN}📱 Conectando instancia $instance a WhatsApp...${NC}"
    
    curl -X POST -H "x-api-key: $api_key" \
         -H "Content-Type: application/json" \
         "http://localhost:$port/api/whatsapp/connect"
    
    echo -e "\n${BLUE}📋 Ver logs para código QR:${NC}"
    echo "  docker compose -f $COMPOSE_FILE logs -f whatsapp-$instance"
}

# Función para limpiar autenticación
clean_auth() {
    local instance=$1
    
    if [[ -z "$instance" ]]; then
        echo -e "${RED}❌ Error: Especifica la instancia (ventas/soporte/marketing)${NC}"
        exit 1
    fi
    
    local port=$(get_port "$instance")
    local api_key=$(get_api_key "$instance")
    
    echo -e "${YELLOW}🧹 Limpiando autenticación de instancia $instance...${NC}"
    
    curl -X POST -H "x-api-key: $api_key" \
         -H "Content-Type: application/json" \
         "http://localhost:$port/api/whatsapp/clean-auth"
    
    echo ""
}

# Función para reconstruir imágenes
rebuild_all() {
    check_config
    echo -e "${BLUE}🔨 Reconstruyendo todas las imágenes...${NC}"
    docker compose -f "$COMPOSE_FILE" build --no-cache
}

# Procesamiento de comandos
case $1 in
    start)
        start_instances "$2"
        ;;
    stop)
        stop_instances "$2"
        ;;
    restart)
        restart_instances "$2"
        ;;
    logs)
        show_logs "$2"
        ;;
    status)
        show_status
        ;;
    connect)
        connect_instance "$2"
        ;;
    clean)
        clean_auth "$2"
        ;;
    rebuild)
        rebuild_all
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}❌ Comando no reconocido: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac