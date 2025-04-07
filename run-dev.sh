#!/bin/bash

QUANTA_CHAT_HOST="12.34.56.78"
QUANTA_CHAT_PORT="8080"
QUANTA_CHAT_HTTP_PORT="80"

yarn build
yarn start

read -p "QuantaChat Ended. press ENTER to exit..."

