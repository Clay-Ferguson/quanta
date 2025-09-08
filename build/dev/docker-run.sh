#!/bin/bash 

# NOTE: Ends up with app running at http://localhost:8000/

# WARNING: You need to 'yarn install' before running this script!

# Check if we're in the project root by looking for package.json
if [ ! -f "./package.json" ]; then
    echo "Error: package.json not found. Run this script from the project root."
    exit 1
fi

./build/clean.sh

echo "Building application..."
export DEV_BUILD_OPTS=true
yarn build

# Check if yarn build succeeded
if [ $? -eq 0 ]; then
    echo "Build successful. Preparing Docker environment..."

    mkdir -p ../quanta-volumes/dev/pgadmin-data

    # If that folder create didn't work, exit with an error
    if [ $? -ne 0 ]; then
        echo "Error: Could not create ../quanta-volumes/dev directory. Please check permissions."
        exit 1
    fi

    # if ../.env-quanta does not exist, display error and exit
    if [ ! -f ../.env-quanta ]; then
        echo "Error: ../.env-quanta file does not exist. Please create it before running this script."
        exit 1
    fi

    # Ensure pgAdmin data directory has correct permissions
    echo "Setting pgAdmin directory permissions..."
    sudo chown -R 5050:5050 ../quanta-volumes/dev/pgadmin-data
    sudo chmod -R 755 ../quanta-volumes/dev/pgadmin-data
    
    # Stop any existing containers
    # docker-compose --env-file .env --env-file ../.env-quanta --profile pgadmin down 
    docker-compose --env-file ./build/dev/.env --env-file ../.env-quanta down 
    
    # Build and start the container
    echo "Starting application with Docker Compose..."
    # docker-compose --env-file .env --env-file ../.env-quanta --profile pgadmin up --build
    docker-compose --env-file ./build/dev/.env --env-file ../.env-quanta up --build
    
    echo "Quanta ended."
else
    echo "Build failed. Terminating script."
    exit 1
fi
