#!/bin/bash

# Grafana Alloy Stack Stop Script
# This script stops the Grafana Alloy monitoring stack

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to check if any Grafana containers are running
check_any_grafana_running() {
    if docker-compose -f "$SCRIPT_DIR/docker-compose.yml" ps --services --filter "status=running" | grep -q "."; then
        return 0  # Some containers are running
    else
        return 1  # No containers are running
    fi
}

# Function to stop Grafana Alloy stack
stop_grafana() {
    echo "Stopping Grafana Alloy monitoring stack..."
    
    # Change to script directory and stop containers
    if (cd "$SCRIPT_DIR" && docker-compose down); then
        echo "✓ Grafana Alloy stack stopped successfully"
        return 0
    else
        echo "✗ Failed to stop Grafana Alloy stack"
        return 1
    fi
}

# Main script logic
echo "Grafana Alloy Stack Stop Manager"
echo "================================="

if check_any_grafana_running; then
    echo "Stopping Grafana Alloy stack..."
    if stop_grafana; then
        echo "Stack shutdown completed successfully!"
    else
        echo "Stack shutdown failed!"
        exit 1
    fi
else
    echo "✓ Grafana Alloy stack is not running"
    echo "No action needed."
fi