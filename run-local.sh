#!/bin/bash

# Stop any existing containers
docker-compose -f docker-compose-local.yaml --env-file ../.env-quanta down 
    
# Build and start the container
echo "Starting application with Docker Compose..."
docker-compose -f docker-compose-local.yaml  --env-file ../.env-quanta up --build

# Exit the script (and shell if run directly)
exit 0

