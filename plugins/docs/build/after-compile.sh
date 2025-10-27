#!/bin/bash 

# Function to display error and pause
error_and_pause() {
    echo "ERROR: $1"
    echo "Press any key to continue..."
    read -n 1 -s
    exit 1
}

# Copy docs plugin SQL files
mkdir -p dist/plugins/docs/server/SQL 

if ! cp plugins/docs/server/SQL/*.sql dist/plugins/docs/server/SQL/ 2>/dev/null; then
    error_and_pause "Failed to copy plugins/docs/server/SQL/*.sql to dist/plugins/docs/server/SQL/"
fi

if ! cp plugins/docs/*.yaml dist/plugins/docs/ 2>/dev/null; then
    error_and_pause "Failed to copy plugins/docs/*.yaml to dist/plugins/docs/"
fi

# Next copy plugins/docs/docs to dist/plugins/docs/docs
mkdir -p dist/docs/extensions/docs
if ! cp -r plugins/docs/docs/* dist/docs/extensions/docs/ 2>/dev/null; then
    error_and_pause "Failed to copy plugins/docs/docs/* to dist/docs/extensions/docs/"
fi

echo "All files copied successfully!"