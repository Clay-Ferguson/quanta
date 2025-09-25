#!/bin/bash

# Configuration
RUN_GRAFANA=${RUN_GRAFANA:-false}

# Check if we're in the project root by looking for package.json
if [ ! -f "./package.json" ]; then
    echo "Error: package.json not found. Run this script from the project root."
    exit 1
fi 

export CONFIG_FILE="./build/local/config.yaml"

./build/kill.sh
rm -f quanta.log

# Run /dist/grafana/alloy/start.sh if it exists
if [ "$RUN_GRAFANA" = "true" ]; then
    if [ -f "./dist/grafana/alloy/restart.sh" ]; then
        echo "Starting existing Grafana Alloy stack..."
        bash ./dist/grafana/alloy/restart.sh
    else
        echo "No existing Grafana Alloy stack start script found. Continuing..."
    fi
fi

# Start the Node.js app in a new session (completely detached)
echo "Starting new AppServer.js process..."

/home/clay/.nvm/versions/node/v22.2.0/bin/node dist/server/AppServer.js

echo "Quanta server process has exited."

