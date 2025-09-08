#!/bin/bash

# Check if we're in the project root by looking for package.json
if [ ! -f "./package.json" ]; then
    echo "Error: package.json not found. Run this script from the project root."
    exit 1
fi

export CONFIG_FILE="./build/local/config.yaml"

./build/kill.sh
rm -f quanta.log

# Start the Node.js app in a new session (completely detached)
echo "Starting new AppServer.js process..."

/home/clay/.nvm/versions/node/v22.2.0/bin/node dist/server/AppServer.js

echo "Quanta server process has exited."

