#!/bin/bash

export QUANTA_CHAT_HOST="localhost"
export QUANTA_CHAT_PORT="8080"
export QUANTA_CHAT_HTTP_PORT="80"

yarn build
yarn start

read -p "QuantaChat Ended. press ENTER to exit..."

