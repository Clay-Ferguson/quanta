#!/bin/bash 

# todo-0: need to rename this file to 'copy-files.sh'

mkdir -p dist/server/
cp server/*.sql dist/server/

# Copy the tests directory
mkdir -p dist/server/tests
cp -r server/tests/* dist/server/tests/

mkdir -p dist/server/plugins/docs/VFS/SQL 
cp server/plugins/docs/VFS/SQL/*.sql dist/server/plugins/docs/VFS/SQL/ 

mkdir -p dist/server/plugins/chat
cp server/plugins/chat/*.sql dist/server/plugins/chat/