#!/bin/bash 

# Check if we're in the project root by looking for package.json
if [ ! -f "./package.json" ]; then
    echo "Error: package.json not found. Please run this script from the project root."
    exit 1
fi

export CONFIG_FILE="./build/dev/config.yaml"

# ./kill.sh

# remove package-lock.json if anythiong ever creates it. This app uses Yarn instead.
rm -f package-lock.json
rm -rf ./dist

# Run the dev script which handles build and start with error checking
QUANTA_DEV=true yarn dev

# Check if yarn dev succeeded
if [ $? -eq 0 ]; then
    read -p "Quanta Chat Ended. press ENTER to exit..."
else
    echo "Dev script failed. Terminating script."
    exit 1
fi

