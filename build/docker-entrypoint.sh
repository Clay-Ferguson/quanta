#!/bin/sh

# Check if DEBUG environment variable is set to enable debugging
if [ "$DEBUG" = "true" ]; then
    echo "Starting Node.js application in debug mode..."
    echo "Debug port 9229 is available for attaching debugger"
    # Start with debugging enabled, listening on all interfaces
    exec node --inspect=0.0.0.0:9229 dist/server/AppServer.js
else
    echo "Starting Node.js application in production mode..."
    # Start normally
    exec node dist/server/AppServer.js
fi