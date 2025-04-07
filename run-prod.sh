#!/bin/bash

export QUANTA_CHAT_HOST="chat.quanta.wiki"
export QUANTA_CHAT_PORT="8080"
export QUANTA_CHAT_HTTP_PORT="80"

# Build client and server separately allows us to run on a tiny DigitalOcean droplet without running out of memory.
yarn build:client
yarn build:server
yarn start

read -p "QuantaChat Ended. press ENTER to exit..."

