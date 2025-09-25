#!/bin/bash 

# todo-0: look for places we have these commands that need to call this script instead

echo "Cleaning project..."

# remove package-lock.json if anything ever creates it, because this app uses Yarn instead.
rm -f package-lock.json

sudo rm -rf ./dist


