#!/bin/bash

# =============================================================================
# This script creates a local installation of the Quanta project, including
# all necessary dependencies and configuration files, in the specified
# target directory (TARGET_DIR) for running locally by either of the two files in this
# directory, named run.sh or run-hidden.sh. The `QDash.desktop` file is just an example
# of how you can setup the app to run from your desktop environment, out of one of these
# installation folders.
# =============================================================================

# Check if we're in the project root by looking for package.json
if [ ! -f "./package.json" ]; then
    echo "Error: package.json not found. Run this script from the project root."
    exit 1
fi

sudo ./build/kill.sh

# local (non-exported var)
TARGET_DIR=/home/clay/ferguson/quanta-local

export CONFIG_FILE="./build/local/config.yaml"
export QUANTA_DEV=true

./build/clean.sh
yarn build

read -p "Quanta Build Complete. Press ENTER sync to deploy folder..."

mkdir -p $TARGET_DIR
mkdir -p $TARGET_DIR/build/local

sudo rsync -aAXvzc --delete --force --progress --stats ./dist/ $TARGET_DIR/dist/
sudo rsync -aAXvzc --delete --force --progress --stats ./node_modules/ $TARGET_DIR/node_modules/
sudo rsync -aAXvzc --delete --force --progress --stats ./build/local/ $TARGET_DIR/build/local/
sudo rsync -aAXvzc --delete --force --progress --stats ./public/ $TARGET_DIR/public/

cp ./package.json $TARGET_DIR/package.json

# Create logs directory with proper permissions
mkdir -p $TARGET_DIR/dist/server/logs

# Fix ownership of all copied files to the current user
sudo chown -R $USER:$USER $TARGET_DIR

read -p "Deploy is done. Press ENTER"