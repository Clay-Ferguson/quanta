#!/bin/bash 

# Configuration
RUN_GRAFANA=false

# Function to setup and start Grafana Alloy stack
start_grafana_alloy() {
    # Theoretically, we could run grafana right in the project folder. But to be consistent, we instead copy it. 
    # to the distribution folder, and run it from there. 
    mkdir -p ./dist/grafana/alloy/
    rsync -aAXvzc --delete --force --progress --stats ./grafana/alloy/ ./dist/grafana/alloy/
    cp ./build/dev/grafana-set-env.sh ./dist/grafana/alloy/

    # Run /dist/grafana/alloy/start.sh if it exists
    if [ -f "./dist/grafana/alloy/start.sh" ]; then
        echo "Starting existing Grafana Alloy stack..."
        bash ./dist/grafana/alloy/start.sh
    else
        echo "No existing Grafana Alloy stack start script found. Continuing..."
    fi
}

# Check if we're in the project root by looking for package.json
if [ ! -f "./package.json" ]; then
    echo "Error: package.json not found. Run this script from the project root."
    exit 1
fi

# Run /dist/grafana/alloy/stop.sh if it exists
if [ -f "./dist/grafana/alloy/stop.sh" ]; then
    echo "Stopping existing Grafana Alloy stack..."
    bash ./dist/grafana/alloy/stop.sh
else
    echo "No existing Grafana Alloy stack stop script found. Continuing..."
fi

export CONFIG_FILE="./build/dev/config.yaml"
export QUANTA_ENV=dev
export DEV_BUILD_OPTS=true

./build/clean.sh

# Run the dev script which handles build and start with error checking
# yarn dev
echo "Building Quanta Server..."
yarn build

if [ "$RUN_GRAFANA" = "true" ]; then
    start_grafana_alloy
fi

# Fix ownership of dist directory to ensure logging works properly
# This needs to be done after grafana setup which might create some root-owned files
sudo chown -R $USER:$USER ./dist/

echo "Starting Quanta Server..."
yarn start

# Check if yarn dev succeeded
if [ $? -eq 0 ]; then
    read -p "Quanta Server Started."
else
    echo "Dev script failed. Terminating script."
    exit 1
fi

