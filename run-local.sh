#!/bin/bash

export QUANTA_CHAT_HOST="localhost"
export QUANTA_CHAT_PORT="8000"
export QUANTA_CHAT_SECURE="n"
export QUANTA_CHAT_DB_FILE_NAME="/home/clay/ferguson/chat-db/quanta-chat.db"
export QUANTA_CHAT_ADMIN_PUBLIC_KEY="0357b752ea2b1bcc0365efa73ab0d573f1c27a948aa256394f991c8c09d8edb7df"

# remove package-lock.json if anythiong ever creates it. This app uses Yarn instead.
rm -f package-lock.json
rm -rf ./dist
QUANTA_DEV=true yarn build
yarn start

read -p "Quanta Chat Ended. press ENTER to exit..."

