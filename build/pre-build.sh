#!/bin/bash

mkdir -p $QUANTA_VOLUMES_PATH/pgadmin-data
mkdir -p $QUANTA_VOLUMES_PATH/logs
mkdir -p $QUANTA_VOLUMES_PATH/tmp

# If that folder create didn't work, exit with an error
if [ $? -ne 0 ]; then
    echo "Error: Could not create $QUANTA_VOLUMES_PATH directory. Please check permissions."
    exit 1
fi

# if ../.env-quanta does not exist, display error and exit
if [ ! -f ../.env-quanta ]; then
    echo "Error: ../.env-quanta file does not exist. Please create it before running this script."
    exit 1
fi

# Ensure pgAdmin data directory has correct permissions
echo "Setting pgAdmin directory permissions..."
sudo chown -R 5050:5050 $QUANTA_VOLUMES_PATH/pgadmin-data
sudo chmod -R 755 $QUANTA_VOLUMES_PATH/pgadmin-data

