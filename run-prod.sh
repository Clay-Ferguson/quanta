#!/bin/bash

QUANTA_CHAT_HOST="localhost"
QUANTA_CHAT_PORT="8080"
QUANTA_CHAT_HTTP_PORT=8000

yarn build
yarn start

read -p "QuantaChat Ended. press ENTER to exit..."

