#!/bin/bash

# Grafana Alloy Stack Restart Script
# This script restarts the Grafana Alloy monitoring stack completely

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for existence of environment configuration file before sourcing
ENV_CONFIG_FILE="$SCRIPT_DIR/grafana-set-env.sh"
if [ ! -f "$ENV_CONFIG_FILE" ]; then
    echo "✗ Error: Environment configuration file not found: $ENV_CONFIG_FILE"
    echo "  Please ensure the grafana-set-env.sh file exists in the same directory as this script."
    exit 1
fi

# Source environment variables
source "$ENV_CONFIG_FILE"

# Function to check if any Grafana containers are running
check_any_grafana_running() {
    if docker-compose -f "$SCRIPT_DIR/docker-compose.yml" ps --services --filter "status=running" | grep -q "."; then
        return 0  # Some containers are running
    else
        return 1  # No containers are running
    fi
}

# Function to restart Grafana Alloy stack
restart_grafana() {
    echo "Restarting Grafana Alloy monitoring stack..."
    
    # Change to script directory and restart containers
    # Using 'restart' is more efficient than 'down && up' as it restarts in place
    if (cd "$SCRIPT_DIR" && docker-compose restart); then
        echo "✓ Grafana Alloy stack restarted successfully"
        echo "  - Alloy UI: http://localhost:12345"
        echo "  - Grafana UI: http://localhost:3000"
        return 0
    else
        echo "✗ Failed to restart Grafana Alloy stack"
        return 1
    fi
}

# Function to perform complete restart (down then up)
complete_restart() {
    echo "Performing complete restart (stop and start) of Grafana Alloy monitoring stack..."
    
    # Change to script directory and perform complete restart
    if (cd "$SCRIPT_DIR" && docker-compose down && docker-compose up -d); then
        echo "✓ Grafana Alloy stack restarted successfully"
        echo "  - Alloy UI: http://localhost:12345"
        echo "  - Grafana UI: http://localhost:3000"
        return 0
    else
        echo "✗ Failed to restart Grafana Alloy stack"
        return 1
    fi
}

# Main script logic
echo "Grafana Alloy Stack Restart Manager"
echo "==================================="

# Check if --complete flag is provided for full down/up cycle
if [ "$1" = "--complete" ]; then
    echo "Performing complete restart (down then up)..."
    if complete_restart; then
        echo "Complete restart completed successfully!"
    else
        echo "Complete restart failed!"
        exit 1
    fi
elif check_any_grafana_running; then
    echo "Restarting running Grafana Alloy stack..."
    if restart_grafana; then
        echo "Restart completed successfully!"
    else
        echo "Restart failed!"
        exit 1
    fi
else
    echo "Grafana Alloy stack is not running. Starting it..."
    # If nothing is running, just start it (same as start.sh behavior)
    if (cd "$SCRIPT_DIR" && docker-compose up -d); then
        echo "✓ Grafana Alloy stack started successfully"
        echo "  - Alloy UI: http://localhost:12345"
        echo "  - Grafana UI: http://localhost:3000"
        echo "Stack startup completed successfully!"
    else
        echo "✗ Failed to start Grafana Alloy stack"
        exit 1
    fi
fi