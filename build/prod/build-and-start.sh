#!/bin/bash

# WARNING: This file is now deprecated/unused. All Prod runs are done thru docker 

# NOTE: This var is not acutally used because we're not doing the build here.
export QUANTA_DEV="true"
export CONFIG_FILE="./build/prod/config.yaml"

# Just in case nginx is running, after certbot use of it. It will be sitting on port 443.
sudo systemctl stop nginx

# Note: the -E flag preserves the environment variables
sudo -E node dist/server/AppServer.js

read -p "Quanta Server Ended. press ENTER to exit..."

