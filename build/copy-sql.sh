#!/bin/bash 

# Function to display error and pause
error_and_pause() {
    echo "ERROR: $1"
    echo "Press any key to continue..."
    read -n 1 -s
    exit 1
}

# Copy server SQL files
mkdir -p dist/server/
if ! cp server/*.sql dist/server/ 2>/dev/null; then
    error_and_pause "Failed to copy server/*.sql to dist/server/"
fi

# Copy docs plugin SQL files
mkdir -p dist/plugins/docs/server/VFS/SQL 
if ! cp plugins/docs/server/VFS/SQL/*.sql dist/plugins/docs/server/VFS/SQL/ 2>/dev/null; then
    error_and_pause "Failed to copy plugins/docs/server/VFS/SQL/*.sql to dist/plugins/docs/server/VFS/SQL/"
fi

# Copy chat plugin SQL files
mkdir -p dist/server/plugins/chat
if ! cp plugins/chat/server/*.sql dist/plugins/chat/server/ 2>/dev/null; then
    error_and_pause "Failed to copy plugins/chat/server/*.sql to dist/plugins/chat/server/"
fi

echo "All SQL files copied successfully!"