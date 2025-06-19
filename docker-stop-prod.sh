#!/bin/bash

echo "Stopping Quanta Docker containers..."
docker-compose -f docker-compose-prod.yaml --env-file ../.env-quanta down 

echo "Removing any orphaned containers..."
docker container prune -f

echo "Quanta Docker containers stopped."
