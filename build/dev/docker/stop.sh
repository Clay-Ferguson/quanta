#!/bin/bash

echo "Stopping Quanta Docker containers..."

docker-compose --env-file ./build/dev/.env --env-file ../.env-quanta --profile pgadmin down 
# docker-compose --env-file ./build/dev/.env --env-file ../.env-quanta down 

echo "Removing any orphaned containers..."
docker container prune -f

echo "Docker PS..."
docker ps

echo "Quanta Docker containers stopped."
