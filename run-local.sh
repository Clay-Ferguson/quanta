#!/bin/bash

export QUANTA_CHAT_HOST="localhost"
export QUANTA_CHAT_PORT="8008"
export QUANTA_CHAT_SECURE="n"
export QUANTA_CHAT_DB_FILE_NAME="/home/clay/ferguson/chat-db-local/quanta-chat.db"
export QUANTA_CHAT_ADMIN_PUBLIC_KEY="0357b752ea2b1bcc0365efa73ab0d573f1c27a948aa256394f991c8c09d8edb7df"
export CONFIG_FILE="./config-dev.yaml"

./kill.sh

# Start the Node.js app in a new session (completely detached)
echo "Starting new ChatServer.js process..."
# Note: The settid and nohup is to ensure the process runs independently of the terminal session
setsid nohup /home/clay/.nvm/versions/node/v22.2.0/bin/node dist/server/ChatServer.js > quanta-chat.log 2>&1 &

# Get the process ID of the last background process
PID=$!

echo "Quanta Chat server started with PID: $PID"
echo "Log output is being written to: quanta-chat.log"
echo "To stop the server later, run: kill $PID"
echo "Process has been started in a new session - it will continue running after terminal closes."

# Give a moment for the process to start
sleep 3

# Exit the script (and shell if run directly)
exit 0

