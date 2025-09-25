#!/bin/bash

# Stop all running Docker containers
echo "Stopping all running Docker containers..."
docker stop $(docker ps -q)

# Check for and terminate any existing AppServer.js processes
echo "Checking for existing AppServer.js processes..."
EXISTING_PIDS=$(pgrep -f "AppServer.js")
if [ ! -z "$EXISTING_PIDS" ]; then
    echo "Found existing AppServer.js processes with PIDs: $EXISTING_PIDS"
    echo "Terminating existing processes..."
    sudo pkill -f "AppServer.js"
    sleep 2
    
    # Check if any processes are still running and force kill if necessary
    REMAINING_PIDS=$(pgrep -f "AppServer.js")
    if [ ! -z "$REMAINING_PIDS" ]; then
        echo "Some processes didn't terminate gracefully, force killing..."
        sudo pkill -9 -f "AppServer.js"
        sleep 1
    fi
    echo "Existing processes terminated."
else
    echo "No existing AppServer.js processes found."
fi
