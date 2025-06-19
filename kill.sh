#!/bin/bash

# NOTE: This is for stopping non-docker based instances.

# Check for and terminate any existing AppServer.js processes
echo "Checking for existing AppServer.js processes..."
EXISTING_PIDS=$(pgrep -f "AppServer.js")
if [ ! -z "$EXISTING_PIDS" ]; then
    echo "Found existing AppServer.js processes with PIDs: $EXISTING_PIDS"
    echo "Terminating existing processes..."
    pkill -f "AppServer.js"
    sleep 2
    
    # Check if any processes are still running and force kill if necessary
    REMAINING_PIDS=$(pgrep -f "AppServer.js")
    if [ ! -z "$REMAINING_PIDS" ]; then
        echo "Some processes didn't terminate gracefully, force killing..."
        pkill -9 -f "AppServer.js"
        sleep 1
    fi
    echo "Existing processes terminated."
else
    echo "No existing AppServer.js processes found."
fi
