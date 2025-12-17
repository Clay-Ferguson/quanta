#!/bin/bash 

# Source nvm to ensure yarn is available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Check if we're in the project root by looking for package.json
if [ ! -f "./package.json" ]; then
    echo "Error: package.json not found. Run this script from the project root."
    exit 1
fi

# NOTE: Ends up with app running at http://localhost:8008/

# WARNING: You need to 'yarn install' before running this script!

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the .env file from the same directory if it exists
if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
fi

./build/clean.sh

echo "Building application..."
export DEV_BUILD_OPTS=true
yarn build

# Check if yarn build succeeded
if [ $? -eq 0 ]; then
    echo "Build successful. Preparing Docker environment..."
    ./build/pre-build.sh
    
    # Stop any existing containers
    docker-compose --env-file ./build/local/.env --env-file ../.env-quanta down 
    
    # Build and start the container
    echo "Starting application with Docker Compose..."
    docker-compose --env-file ./build/local/.env --env-file ../.env-quanta up --build
    
    echo "Quanta ended."
else
    echo "Build failed. Terminating script."
    exit 1
fi
