#!/bin/bash

# Stop any existing containers
docker-compose -f docker-compose-prod.yaml --env-file ../.env-quanta down 
    
# Build and start the container
echo "Starting application with Docker Compose..."
docker-compose -f docker-compose-prod.yaml  --env-file ../.env-quanta up --build

read -p "Quanta Ended. press ENTER to exit..."

