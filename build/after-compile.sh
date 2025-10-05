#!/bin/bash 

# Copy server SQL files
mkdir -p dist/server/db/
if ! cp server/db/*.sql dist/server/db/ 2>/dev/null; then
    error_and_pause "Failed to copy server/db/*.sql to dist/server/db/"
fi

# Find and run all after-compile.sh scripts in plugin build directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Looking for plugin after-compile.sh scripts in: $PROJECT_ROOT/plugins"

# Find all after-compile.sh scripts in plugins/*/build/ directories
for copy_script in "$PROJECT_ROOT"/plugins/*/build/after-compile.sh; do
    # Check if the file exists (glob doesn't match if no files found)
    if [ -f "$copy_script" ]; then
        plugin_dir=$(dirname "$(dirname "$copy_script")")
        plugin_name=$(basename "$plugin_dir")
        
        echo "Running after-compile.sh for plugin: $plugin_name"
        echo "Script location: $copy_script"
        
        # Make the script executable and run it
        chmod +x "$copy_script"
        if bash "$copy_script"; then
            echo "✓ Successfully ran after-compile.sh for $plugin_name"
        else
            echo "✗ Failed to run after-compile.sh for $plugin_name"
            exit 1
        fi
        echo ""
    fi
done

echo "All SQL files copied successfully!"