#!/bin/bash 

export CONFIG_FILE="./config-dev.yaml"

# WARNING: You need to 'yarn install' before running this script!

# remove package-lock.json if anything ever creates it. This app uses Yarn instead.
rm -f package-lock.json
rm -rf ./dist

echo "Building application..."
QUANTA_DEV=true yarn build

# Check if yarn build succeeded
if [ $? -eq 0 ]; then
    echo "Build successful. Preparing Docker environment..."
    
    # Ensure pgAdmin data directory has correct permissions
    if [ -d "./pgadmin-data" ]; then
        echo "Setting pgAdmin directory permissions..."
        sudo chown -R 5050:5050 ./pgadmin-data
        sudo chmod -R 755 ./pgadmin-data
    fi
    
    # Stop any existing containers
    docker-compose -f docker-compose-dev.yaml down 
    
    # Build and start the container
    echo "Starting application with Docker Compose..."
    docker-compose -f docker-compose-dev.yaml up --build
    
    echo "Quanta Chat ended."
else
    echo "Build failed. Terminating script."
    exit 1
fi

