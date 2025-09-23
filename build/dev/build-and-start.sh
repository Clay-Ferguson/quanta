#!/bin/bash 

# Configuration
RUN_GRAFANA=true

# Check if we're in the project root by looking for package.json
if [ ! -f "./package.json" ]; then
    echo "Error: package.json not found. Run this script from the project root."
    exit 1
fi

# Function to manage Grafana Alloy based on RUN_GRAFANA setting
manage_grafana() {
    if [ "$RUN_GRAFANA" = "true" ]; then
        echo "Managing Grafana Alloy monitoring..."
        
        # Call the dedicated start script
        if "./grafana/logs-file/start.sh"; then
            echo "✓ Grafana Alloy management completed"
        else
            echo "Warning: Grafana Alloy startup had issues. Continuing with Quanta startup..."
        fi
    else
        echo "Grafana Alloy monitoring disabled (RUN_GRAFANA=false)"
    fi
}

export CONFIG_FILE="./build/dev/config.yaml"
export QUANTA_ENV=dev
export DEV_BUILD_OPTS=true

# Manage Grafana Alloy monitoring stack
manage_grafana

# ./kill.sh

./build/clean.sh

# Run the dev script which handles build and start with error checking
yarn dev

# Check if yarn dev succeeded
if [ $? -eq 0 ]; then
    read -p "Quanta Server Started."
else
    echo "Dev script failed. Terminating script."
    exit 1
fi

