#!/bin/bash 

export CONFIG_FILE="./config-dev.yaml"

./kill.sh

# remove package-lock.json if anythiong ever creates it. This app uses Yarn instead.
rm -f package-lock.json
rm -rf ./dist
QUANTA_DEV=true yarn build

# Check if yarn build succeeded
if [ $? -eq 0 ]; then
    yarn start
    read -p "Quanta Chat Ended. press ENTER to exit..."
else
    echo "Build failed. Terminating script."
    exit 1
fi

