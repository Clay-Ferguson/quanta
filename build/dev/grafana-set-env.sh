#!/bin/bash

# Grafana Alloy Stack Environment Variables
# This script sets all the environment variables used across the Grafana Alloy monitoring stack

# Core directory paths
export GRAFANA_LOGS_SOURCE_DIR="/home/clay/ferguson/quanta/dist/server/logs"
export GRAFANA_DB_BASE_DIR="/home/clay/ferguson/grafana-data/dev/database"

# Derived directory paths (used internally by scripts)
export GRAFANA_DATA_DIR="$GRAFANA_DB_BASE_DIR/grafana"
export LOKI_DATA_DIR="$GRAFANA_DB_BASE_DIR/loki"
export ALLOY_DATA_DIR="$GRAFANA_DB_BASE_DIR/alloy"

# Docker image versions (optional - docker-compose.yml has defaults)
# Uncomment and set specific versions if needed, otherwise defaults will be used
# export GRAFANA_VERSION="12.0.2"
# export GRAFANA_LOKI_VERSION="3.5.2"
# export GRAFANA_ALLOY_VERSION="v1.10.0"