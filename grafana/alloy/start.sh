#!/bin/bash

# Grafana Alloy Stack Startup Script
# This script starts the Grafana Alloy monitoring stack for Quanta logs

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source environment variables
source "$SCRIPT_DIR/set-env.sh"

# Function to setup persistent storage directories
setup_persistent_storage() {
    echo "Setting up persistent storage directories..."
    
    # Create base directory if it doesn't exist
    if [ ! -d "$GRAFANA_DB_BASE_DIR" ]; then
        echo "  Creating base directory: $GRAFANA_DB_BASE_DIR"
        mkdir -p "$GRAFANA_DB_BASE_DIR"
    fi
    
    # Create and set permissions for Grafana directory
    if [ ! -d "$GRAFANA_DATA_DIR" ]; then
        echo "  Creating Grafana data directory: $GRAFANA_DATA_DIR"
        mkdir -p "$GRAFANA_DATA_DIR"
    fi
    echo "  Setting Grafana permissions (user ID 472)..."
    sudo chown -R 472:472 "$GRAFANA_DATA_DIR" 2>/dev/null || {
        echo "  Warning: Could not set Grafana permissions. You may need to run with sudo."
    }
    
    # Create and set permissions for Loki directory
    if [ ! -d "$LOKI_DATA_DIR" ]; then
        echo "  Creating Loki data directory: $LOKI_DATA_DIR"
        mkdir -p "$LOKI_DATA_DIR"
    fi
    echo "  Setting Loki permissions (user ID 10001)..."
    sudo chown -R 10001:10001 "$LOKI_DATA_DIR" 2>/dev/null || {
        echo "  Warning: Could not set Loki permissions. You may need to run with sudo."
    }
    
    # Create Alloy directory (runs as root, so no special permissions needed)
    if [ ! -d "$ALLOY_DATA_DIR" ]; then
        echo "  Creating Alloy data directory: $ALLOY_DATA_DIR"
        mkdir -p "$ALLOY_DATA_DIR"
    fi
    
    # Set general read/write permissions
    echo "  Setting general directory permissions..."
    sudo chmod -R 755 "$GRAFANA_DB_BASE_DIR" 2>/dev/null || {
        echo "  Warning: Could not set directory permissions. You may need to run with sudo."
    }
    
    echo "✓ Persistent storage setup completed"
}

# Function to check if Grafana Alloy containers are running
check_grafana_running() {
    # Check if all required containers are running
    if docker-compose -f "$SCRIPT_DIR/docker-compose.yml" ps --services --filter "status=running" | grep -q "alloy\|loki\|grafana"; then
        # Get the count of running containers vs total containers
        local running_count=$(docker-compose -f "$SCRIPT_DIR/docker-compose.yml" ps --services --filter "status=running" | wc -l)
        local total_count=$(docker-compose -f "$SCRIPT_DIR/docker-compose.yml" config --services | wc -l)
        
        if [ "$running_count" -eq "$total_count" ]; then
            return 0  # All containers are running
        else
            return 1  # Some containers are not running
        fi
    else
        return 1  # No containers are running
    fi
}

# Function to start Grafana Alloy stack
start_grafana() {
    echo "Starting Grafana Alloy monitoring stack..."
    
    # Change to script directory and start containers
    if (cd "$SCRIPT_DIR" && docker-compose up -d); then
        echo "✓ Grafana Alloy stack started successfully"
        echo "  - Alloy UI: http://localhost:12345"
        echo "  - Grafana UI: http://localhost:3000"
        return 0
    else
        echo "✗ Failed to start Grafana Alloy stack"
        return 1
    fi
}

# Main script logic
echo "Grafana Alloy Stack Manager"
echo "============================"

# Always ensure persistent storage is properly configured
setup_persistent_storage

if check_grafana_running; then
    echo "✓ Grafana Alloy stack is already running"
    echo "  - Alloy UI: http://localhost:12345"
    echo "  - Grafana UI: http://localhost:3000"
    echo "No action needed."
else
    echo "Grafana Alloy stack is not running, starting it..."
    if start_grafana; then
        echo "Stack startup completed successfully!"
    else
        echo "Stack startup failed!"
        exit 1
    fi
fi