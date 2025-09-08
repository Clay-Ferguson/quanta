#!/bin/bash

echo "Stopping Quanta Docker containers..."
docker-compose --env-file ./build/local/.env --env-file ../.env-quanta down 

echo "Removing any orphaned containers..."
docker container prune -f

echo "Quanta Docker containers stopped."
