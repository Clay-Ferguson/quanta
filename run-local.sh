#!/bin/bash

export QUANTA_CHAT_HOST="localhost"
export QUANTA_CHAT_PORT="8000"
export QUANTA_CHAT_SECURE="n"
export QUANTA_CHAT_DB_FILE_NAME="./db/quanta-chat.db"

yarn build
yarn start

# Run from Dist folder only

#sudo -E node dist/server/index.js

read -p "Quanta Chat Ended. press ENTER to exit..."

