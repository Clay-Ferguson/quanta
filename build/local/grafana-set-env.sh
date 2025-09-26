#!/bin/bash 

# Grafana Alloy Stack Environment Variables - LOCAL/PRODUCTION Environment
# This script sets all the environment variables used across the Grafana Alloy monitoring stack
# Uses different ports from development to avoid conflicts

# Core directory paths
# todo-3: these config settings are not currently used OR correct, but just examples
export GRAFANA_LOGS_SOURCE_DIR="/home/clay/ferguson/quanta-local/dist/server/logs"
export GRAFANA_DB_BASE_DIR="/home/clay/ferguson/grafana-data/local/database"

# Derived directory paths (used internally by scripts)
export GRAFANA_DATA_DIR="$GRAFANA_DB_BASE_DIR/grafana"
export LOKI_DATA_DIR="$GRAFANA_DB_BASE_DIR/loki"
export ALLOY_DATA_DIR="$GRAFANA_DB_BASE_DIR/alloy"

# Environment identification
export GRAFANA_ENV_SUFFIX="local"   # Suffix for container names to identify environment

# Port configurations for Grafana services - LOCAL/PRODUCTION ports (different from dev)
export GRAFANA_PORT="3001"           # Grafana UI port (dev uses 3000)
export LOKI_PORT="3101"             # Loki API port (dev uses 3100)
export ALLOY_HTTP_PORT="12346"      # Alloy HTTP server port (dev uses 12345)
export ALLOY_OTLP_PORT="4319"       # Alloy OTLP receiver port (dev uses 4318)

# Docker image versions (optional - docker-compose.yml has defaults)
# Uncomment and set specific versions if needed, otherwise defaults will be used
# export GRAFANA_VERSION="12.0.2"
# export GRAFANA_LOKI_VERSION="3.5.2"
# export GRAFANA_ALLOY_VERSION="v1.10.0"