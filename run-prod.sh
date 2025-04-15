#!/bin/bash

export QUANTA_CHAT_HOST="chat.quanta.wiki"
export QUANTA_CHAT_PORT="443"

# NOTE: Secure="Y" will require SSL certs to be installed on the server, and expect the
# website to be available at https://... and web socket at wss://...
export QUANTA_CHAT_SECURE="y"

export QUANTA_CHAT_DB_FILE_NAME="./db/quanta-chat.db"
export QUANTA_CHAT_CERT_PATH="/etc/letsencrypt/live/chat.quanta.wiki"

# yarn build:client
# yarn build:server
# yarn start

# Run from Dist folder only

# Note: the -E flag preserves the environment variables
sudo -E node dist/server/index.js

read -p "Quanta Chat Ended. press ENTER to exit..."

