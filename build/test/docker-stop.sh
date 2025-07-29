#!/bin/bash

# Docker Test Environment Stop Script

echo "Stopping Docker test environment..."

# Check if we're in the project root by looking for package.json
if [ ! -f "./package.json" ]; then
    echo "Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Stop and remove test containers
docker-compose --env-file ./build/test/.env --env-file ../.env-quanta -f docker-compose.test.yaml down

# Remove test volumes
echo "Cleaning up test volumes..."
docker volume ls -q --filter name=test | xargs -r docker volume rm

# Remove test images if they exist
echo "Cleaning up test images..."
docker images -q quanta_quanta-test 2>/dev/null | xargs -r docker rmi

echo "✅ Docker test environment cleaned up."
