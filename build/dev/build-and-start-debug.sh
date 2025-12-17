#!/bin/bash 

# NOTE: Ends up with app running at http://localhost:8000/ with debugging enabled

# WARNING: You need to 'yarn install' before running this script!

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the .env file from the same directory if it exists
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
fi

./build/dev/stop.sh

# Source nvm to ensure yarn is available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Check if we're in the project root by looking for package.json
if [ ! -f "./package.json" ]; then
    echo "Error: package.json not found. Run this script from the project root."
    exit 1
fi

./build/clean.sh

echo "Building application for debugging..."
export DEV_BUILD_OPTS=true
yarn build

# Check if yarn build succeeded
if [ $? -eq 0 ]; then
    echo "Build successful. Preparing Docker environment with debugging enabled..."
    ./build/pre-build.sh

    # Build and start the container with debugging enabled
    echo "Starting application with Docker Compose (Debug Mode)..."
    echo "Node.js debugger will be available on port 9229"
    echo "Use 'Attach to Quanta Docker Server' configuration in VS Code to debug"

    # Override environment variables to force debug mode
    export DEBUG=true
    export DEBUG_PORT=9229
    
    # Start with debug profile and explicit debug environment
    # NOTE: By using --force-recreate, that is the same as running 'down' before the 'up'
    DEBUG=true DEBUG_PORT=9229 docker-compose --env-file ./build/dev/.env --env-file ../.env-quanta --profile pgadmin up --build --force-recreate --remove-orphans
    echo "Quanta ended."
else
    echo "Build failed. Terminating script."
    exit 1
fi