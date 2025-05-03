#!/bin/bash

export QUANTA_CHAT_HOST="chat.quanta.wiki"
export QUANTA_CHAT_PORT="443"

# NOTE: Secure="Y" will require SSL certs to be installed on the server, and expect the
# website to be available at https://... and web socket at wss://...
export QUANTA_CHAT_SECURE="y"

export QUANTA_CHAT_DB_FILE_NAME="./db/quanta-chat.db"
export QUANTA_CHAT_CERT_PATH="/etc/letsencrypt/live/chat.quanta.wiki"
export QUANTA_CHAT_ADMIN_PUBLIC_KEY="0357b752ea2b1bcc0365efa73ab0d573f1c27a948aa256394f991c8c09d8edb7df"

# NOTE: This var is not acutally used because we're not doing the build here.
export QUANTA_DEV="true"

# Note: the -E flag preserves the environment variables
sudo -E node dist/server/ChatServer.js

read -p "Quanta Chat Ended. press ENTER to exit..."

