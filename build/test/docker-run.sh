#!/bin/bash 

# NOTE: Runs Jest tests inside Docker containers with PostgreSQL available

# WARNING: You need to 'yarn install' before running this script!

# Check if we're in the project root by looking for package.json
if [ ! -f "./package.json" ]; then
    echo "Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# remove package-lock.json if anything ever creates it. This app uses Yarn instead.
rm -f package-lock.json
rm -rf ./dist

echo "Building application for testing..."
QUANTA_DEV=true yarn build

# Check if yarn build succeeded
if [ $? -eq 0 ]; then
    echo "Build successful. Preparing Docker test environment..."

    mkdir -p ../quanta-volumes/test/postgres-data
    mkdir -p ./test-results

    # If that folder create didn't work, exit with an error
    if [ $? -ne 0 ]; then
        echo "Error: Could not create ../quanta-volumes/test directory. Please check permissions."
        exit 1
    fi

    # if ../.env-quanta does not exist, display error and exit
    if [ ! -f ../.env-quanta ]; then
        echo "Error: ../.env-quanta file does not exist. Please create it before running this script."
        exit 1
    fi

    # Stop any existing test containers
    echo "Stopping any existing test containers..."
    docker-compose --env-file ./build/test/.env --env-file ../.env-quanta -f docker-compose.test.yaml down 
    
    # Remove any existing test volumes to ensure clean state
    echo "Cleaning up test data..."
    docker volume prune -f
    
    # Temporarily use test-specific dockerignore for building test container
    if [ -f .dockerignore ]; then
        mv .dockerignore .dockerignore.prod
    fi
    if [ -f .dockerignore.test ]; then
        cp .dockerignore.test .dockerignore
    fi
    
    # Build and start the test containers
    echo "Starting test environment with Docker Compose..."
    docker-compose --env-file ./build/test/.env --env-file ../.env-quanta -f docker-compose.test.yaml up --build --abort-on-container-exit
    
    # Capture the exit code from the test container
    TEST_EXIT_CODE=$?
    
    # Restore original dockerignore
    if [ -f .dockerignore.prod ]; then
        mv .dockerignore.prod .dockerignore
    fi
    
    # Clean up test containers
    echo "Cleaning up test containers..."
    docker-compose --env-file ./build/test/.env --env-file ../.env-quanta -f docker-compose.test.yaml down
    
    # Restore original dockerignore if we haven't already
    if [ -f .dockerignore.prod ]; then
        mv .dockerignore.prod .dockerignore
    fi
    
    # Report results
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        echo "✅ All tests passed!"
        echo "📊 Coverage report available in ./coverage/"
    else
        echo "❌ Tests failed with exit code: $TEST_EXIT_CODE"
        exit $TEST_EXIT_CODE
    fi
else
    echo "Build failed. Cannot proceed with testing."
    exit 1
fi
