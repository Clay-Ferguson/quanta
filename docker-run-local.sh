#!/bin/bash 

# NOTE: Ends up with app running at http://localhost:8008/

# WARNING: You need to 'yarn install' before running this script!

# remove package-lock.json if anything ever creates it. This app uses Yarn instead.
rm -f package-lock.json
rm -rf ./dist

echo "Building application..."
QUANTA_DEV=true yarn build

# Check if yarn build succeeded
if [ $? -eq 0 ]; then
    echo "Build successful. Preparing Docker environment..."

    mkdir -p ../quanta-volumes/local/pgadmin-data

    # If that folder create didn't work, exit with an error
    if [ $? -ne 0 ]; then
        echo "Error: Could not create ../quanta-volumes/local directory. Please check permissions."
        exit 1
    fi

    # if ../.env-quanta does not exist, display error and exit
    if [ ! -f ../.env-quanta ]; then
        echo "Error: ../.env-quanta file does not exist. Please create it before running this script."
        exit 1
    fi

    # Ensure pgAdmin data directory has correct permissions
    echo "Setting pgAdmin directory permissions..."
    sudo chown -R 5050:5050 ../quanta-volumes/local/pgadmin-data
    sudo chmod -R 755 ../quanta-volumes/local/pgadmin-data
    
    # Stop any existing containers
    docker-compose -f docker-compose-local.yaml --env-file ../.env-quanta down 
    
    # Build and start the container
    echo "Starting application with Docker Compose..."
    docker-compose -f docker-compose-local.yaml  --env-file ../.env-quanta up --build
    
    echo "Quanta ended."
else
    echo "Build failed. Terminating script."
    exit 1
fi
