#!/bin/bash 

export CONFIG_FILE="./config-dev.yaml"

# remove package-lock.json if anythiong ever creates it. This app uses Yarn instead.
rm -f package-lock.json
rm -rf ./dist
QUANTA_DEV=true yarn build

yarn start

read -p "Quanta Chat Ended. press ENTER to exit..."

