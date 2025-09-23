#!/bin/bash

# Grafana Alloy Stack Startup Script
# This script starts the Grafana Alloy monitoring stack for Quanta logs

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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