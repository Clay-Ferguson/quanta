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

# Environment identification
export GRAFANA_ENV_SUFFIX="dev"     # Suffix for container names to identify environment

# Port configurations for Grafana services
export GRAFANA_PORT="3000"           # Grafana UI port
export LOKI_PORT="3100"             # Loki API port
export ALLOY_HTTP_PORT="12345"      # Alloy HTTP server port
export ALLOY_OTLP_PORT="4318"       # Alloy OTLP receiver port

# Docker image versions (optional - docker-compose.yml has defaults)
# Uncomment and set specific versions if needed, otherwise defaults will be used
# export GRAFANA_VERSION="12.0.2"
# export GRAFANA_LOKI_VERSION="3.5.2"
# export GRAFANA_ALLOY_VERSION="v1.10.0"