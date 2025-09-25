#!/bin/bash

# NOTE: run-hidden.sh runs the server in the background, detached from the terminal. This script should behave
#       the same as run.sh except for this one running in a hidden terminal which is useful for the `QDash.desktop`
#       way of running the app on Linux.

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

# Note: The settid and nohup is to ensure the process runs independently of the terminal session
setsid nohup /home/clay/.nvm/versions/node/v22.2.0/bin/node dist/server/AppServer.js > quanta.log 2>&1 &

# Get the process ID of the last background process
PID=$!

echo "Quanta Chat server started with PID: $PID"
echo "Log output is being written to: quanta.log"
echo "To stop the server later, run: kill $PID"
echo "Process has been started in a new session - it will continue running after terminal closes."

# Give a moment for the process to start
sleep 3

# Exit the script (and shell if run directly)
exit 0

