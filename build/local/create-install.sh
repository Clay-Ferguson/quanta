#!/bin/bash

# todo-0: Need to update platform `developer_guide.md` to discuss this script.

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

read -p "Deploy is done. Press ENTER"