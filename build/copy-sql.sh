#!/bin/bash 

mkdir -p dist/server/
cp server/*.sql dist/server/

mkdir -p dist/server/plugins/docs/VFS/SQL 
cp server/plugins/docs/VFS/SQL/*.sql dist/server/plugins/docs/VFS/SQL/ 

mkdir -p dist/server/plugins/chat
cp server/plugins/chat/*.sql dist/server/plugins/chat/