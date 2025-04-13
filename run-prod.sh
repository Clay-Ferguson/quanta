#!/bin/bash

export QUANTA_CHAT_HOST="chat.quanta.wiki"
export QUANTA_CHAT_PORT="8080"
export QUANTA_CHAT_HTTP_PORT="80"

# yarn build:client
# yarn build:server
# yarn start

# Run from Dist folder only

# Note: the -E flag preserves the environment variables
pushd server
ln -sf ../common ./common-shared 
popd
sudo -E node dist/server/index.js

read -p "Quanta Chat Ended. press ENTER to exit..."

