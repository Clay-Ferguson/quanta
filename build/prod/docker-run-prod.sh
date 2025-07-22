#!/bin/bash

echo "This script is not correct, and is only a hint. To run on production the way to do this would actually be"
echo "to build on a build machine and then copy the built image to the production server, and then run, which is NOT"
echo "what this script does. This script is only a hint, and should not be used in production."
exit 1

# Check if we're in the project root by looking for package.json
if [ ! -f "./package.json" ]; then
    echo "Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Stop any existing containers
docker-compose --env-file ./build/prod/.env --env-file ../.env-quanta down 
    
# Build and start the container
echo "Starting application with Docker Compose..."
docker-compose --env-file ./build/prod/.env --env-file ../.env-quanta up --build

read -p "Quanta Ended. press ENTER to exit..."

