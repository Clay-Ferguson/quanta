#!/bin/bash

read -p "About to run. press ENTER to continue..."

# Check for and terminate any existing ChatServer.js processes
echo "Checking for existing ChatServer.js processes..."
EXISTING_PIDS=$(pgrep -f "ChatServer.js")
if [ ! -z "$EXISTING_PIDS" ]; then
    echo "Found existing ChatServer.js processes with PIDs: $EXISTING_PIDS"
    echo "Terminating existing processes..."
    pkill -f "ChatServer.js"
    sleep 2
    
    # Check if any processes are still running and force kill if necessary
    REMAINING_PIDS=$(pgrep -f "ChatServer.js")
    if [ ! -z "$REMAINING_PIDS" ]; then
        echo "Some processes didn't terminate gracefully, force killing..."
        pkill -9 -f "ChatServer.js"
        sleep 1
    fi
    echo "Existing processes terminated."
else
    echo "No existing ChatServer.js processes found."
fi
