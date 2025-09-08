#!/bin/bash 

# Check if we're in the project root by looking for package.json
if [ ! -f "./package.json" ]; then
    echo "Error: package.json not found. Run this script from the project root."
    exit 1
fi

export CONFIG_FILE="./build/dev/config.yaml"
export QUANTA_ENV=dev
export DEV_BUILD_OPTS=true

# ./kill.sh

./build/clean.sh

# Run the dev script which handles build and start with error checking
yarn dev

# Check if yarn dev succeeded
if [ $? -eq 0 ]; then
    read -p "Quanta Server Started."
else
    echo "Dev script failed. Terminating script."
    exit 1
fi

