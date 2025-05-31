#!/bin/bash 

export CONFIG_FILE="./config-dev.yaml"

# remove package-lock.json if anythiong ever creates it. This app uses Yarn instead.
# todo-0: need to separate these three lines into 'build-dev.sh' so we can run it from our deployment script
rm -f package-lock.json
rm -rf ./dist
QUANTA_DEV=true yarn build

yarn start

read -p "Quanta Chat Ended. press ENTER to exit..."

