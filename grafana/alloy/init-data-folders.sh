#!/bin/bash

# Grafana Data Folders Initialization Script
# This script ensures that all required data directories exist with proper permissions
# for the Grafana Alloy monitoring stack containers

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for existence of environment configuration file before sourcing
ENV_CONFIG_FILE="$SCRIPT_DIR/grafana-set-env.sh"
if [ ! -f "$ENV_CONFIG_FILE" ]; then
    echo "✗ Error: Environment configuration file not found: $ENV_CONFIG_FILE"
    echo "  Please ensure the grafana-set-env.sh file exists in the same directory as this script."
    exit 1
fi

# Source environment variables to get directory paths
source "$ENV_CONFIG_FILE"

# ============================================================================
# FUNCTION DEFINITIONS (must be defined before use)
# ============================================================================

# Function to validate directory safety before modification
validate_directory_safety() {
    local dir="$1"
    local description="$2"
    
    # Check if directory path is absolute and contains expected patterns
    if [[ ! "$dir" =~ ^/home/.* ]] && [[ ! "$dir" =~ ^/tmp/.* ]] && [[ ! "$dir" =~ ^/var/lib/.* ]]; then
        echo "  ✗ SAFETY ERROR: Directory path '$dir' is not in a safe location"
        echo "    Only directories under /home, /tmp, or /var/lib are allowed"
        return 1
    fi
    
    # Check if path contains dangerous patterns
    if [[ "$dir" =~ ^/$ ]] || [[ "$dir" =~ ^/home/?$ ]] || [[ "$dir" =~ ^/usr ]] || [[ "$dir" =~ ^/etc ]] || [[ "$dir" =~ ^/bin ]] || [[ "$dir" =~ ^/sbin ]]; then
        echo "  ✗ SAFETY ERROR: Directory path '$dir' is a system directory - modification not allowed"
        return 1
    fi
    
    # Check if directory exists and get current ownership
    if [ -d "$dir" ]; then
        local current_owner=$(stat -c '%U' "$dir" 2>/dev/null)
        if [ "$current_owner" = "root" ]; then
            echo "  ✗ SAFETY ERROR: Directory '$dir' is currently owned by root"
            echo "    Will not modify root-owned directories for security reasons"
            return 1
        fi
    fi
    
    # Check if the directory path length is reasonable (prevent path traversal)
    if [ ${#dir} -gt 200 ]; then
        echo "  ✗ SAFETY ERROR: Directory path is too long (${#dir} characters)"
        return 1
    fi
    
    # Ensure the path doesn't contain suspicious characters
    if [[ "$dir" =~ \.\./|\;|\&\&|\|\| ]] || [[ "$dir" =~ [[:cntrl:]] ]]; then
        echo "  ✗ SAFETY ERROR: Directory path contains suspicious characters"
        return 1
    fi
    
    echo "  ✓ Safety validation passed for $description: $dir"
    return 0
}

# Function to create directory if it doesn't exist
create_directory() {
    local dir="$1"
    
    # Validate directory safety before creation
    if ! validate_directory_safety "$dir" "directory creation target"; then
        echo "  ✗ Skipping directory creation due to safety validation failure"
        return 1
    fi
    
    if [ ! -d "$dir" ]; then
        echo "  Creating directory: $dir"
        mkdir -p "$dir"
        if [ $? -eq 0 ]; then
            echo "  ✓ Directory created successfully"
        else
            echo "  ✗ Failed to create directory: $dir"
            return 1
        fi
    else
        echo "  ✓ Directory already exists: $dir"
    fi
    return 0
}

# Function to set ownership for a directory
set_ownership() {
    local dir="$1"
    local owner="$2"
    local description="$3"
    
    # Validate directory safety first
    if ! validate_directory_safety "$dir" "$description"; then
        echo "  ✗ Skipping ownership change due to safety validation failure"
        return 1
    fi
    
    echo "  Setting ownership for $description: $dir → $owner"
    if sudo chown -R "$owner" "$dir" 2>/dev/null; then
        echo "  ✓ Ownership set successfully"
        return 0
    else
        echo "  ✗ Failed to set ownership for $dir"
        return 1
    fi
}

# Create base directory structure
echo "Creating base directories..."
create_directory "$GRAFANA_DB_BASE_DIR" || exit 1
create_directory "$GRAFANA_DATA_DIR" || exit 1
create_directory "$LOKI_DATA_DIR" || exit 1
create_directory "$ALLOY_DATA_DIR" || exit 1

# Set proper ownership for each service
echo "Setting directory ownership..."

# Grafana runs as UID 472
echo "Setting Grafana permissions..."
set_ownership "$GRAFANA_DATA_DIR" "472:472" "Grafana data directory"

# Loki runs as UID 10001  
echo "Setting Loki permissions..."
set_ownership "$LOKI_DATA_DIR" "10001:10001" "Loki data directory"

# Alloy runs as current user
echo "Setting Alloy permissions..."
set_ownership "$ALLOY_DATA_DIR" "$USER:$USER" "Alloy data directory"

# Also ensure the logs source directory exists and has proper permissions
if [ -n "$GRAFANA_LOGS_SOURCE_DIR" ]; then
    echo "Setting up logs source directory..."
    create_directory "$GRAFANA_LOGS_SOURCE_DIR" || exit 1
    set_ownership "$GRAFANA_LOGS_SOURCE_DIR" "$USER:$USER" "Logs source directory"
fi

echo "✓ Grafana data directories initialization completed successfully!"
echo "  - Grafana data: $GRAFANA_DATA_DIR (UID 472)"
echo "  - Loki data: $LOKI_DATA_DIR (UID 10001)" 
echo "  - Alloy data: $ALLOY_DATA_DIR ($USER)"
if [ -n "$GRAFANA_LOGS_SOURCE_DIR" ]; then
    echo "  - Logs source: $GRAFANA_LOGS_SOURCE_DIR ($USER)"
fi