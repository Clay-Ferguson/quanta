# How to Debug Quanta Applications

This guide explains how to set up and use debugging for the Quanta platform, including both the core platform and plugin development. The Quanta debugging setup allows you to set breakpoints, step through code, inspect variables, and debug TypeScript source files directly in VS Code.

## Overview

Quanta supports two debugging modes:

1. **Docker-based debugging**: Debug the application running inside Docker containers (recommended for full-stack development)
2. **Local debugging**: Debug the server running directly on your machine (for server-only development)

This guide focuses on Docker-based debugging since it provides the most realistic development environment that matches production deployment.

## Prerequisites

Before setting up debugging, ensure you have:

- **Node.js**: Installed via nvm (v18+ recommended)
- **Yarn**: Package manager for building the project
- **Docker & Docker Compose**: For containerized debugging
- **VS Code**: With the following extensions:
  - Node.js debugging support (built-in)
  - TypeScript and JavaScript Language Features (built-in)

## Architecture Overview

The debugging setup consists of several components:

1. **Docker Configuration**: Modified to conditionally start Node.js in debug mode
2. **Entrypoint Script**: Handles debug vs production startup
3. **Environment Variables**: Control debug mode activation
4. **VS Code Configuration**: Launch configurations for attaching to debug sessions
5. **Build Scripts**: Separate scripts for debug and production modes

## Docker Debug Configuration

### Modified Dockerfile

The Dockerfile has been enhanced to support debugging:

```dockerfile
# Expose debug port for Node.js debugging
EXPOSE 9229

# Use a script to handle both debug and non-debug modes
COPY build/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Start the application
CMD ["./docker-entrypoint.sh"]
```

### Docker Entrypoint Script

The entrypoint script (`build/docker-entrypoint.sh`) conditionally starts Node.js in debug mode:

```bash
#!/bin/sh

# Check if DEBUG environment variable is set to enable debugging
if [ "$DEBUG" = "true" ]; then
    echo "Starting Node.js application in debug mode..."
    echo "Debug port 9229 is available for attaching debugger"
    # Start with debugging enabled, listening on all interfaces
    exec node --inspect=0.0.0.0:9229 dist/server/AppServer.js
else
    echo "Starting Node.js application in production mode..."
    # Start normally
    exec node dist/server/AppServer.js
fi
```

### Docker Compose Configuration

The `docker-compose.yaml` includes debug port exposure:

```yaml
quanta-app:
  ports:
    - "${APP_PORT:-8000}:8000"
    # Debug port for Node.js debugging
    - "${DEBUG_PORT:-9229}:9229"
  environment:
    # Enable debugging based on environment variable
    - DEBUG=${DEBUG:-false}
    # ... other environment variables
```

### Environment Configuration

The development environment file (`build/dev/.env`) defines debug settings:

```properties
# Development Environment Configuration
QUANTA_ENV=dev
APP_PORT=8000
DEBUG_PORT=9229
# ... other settings
```

## Build Scripts

### Debug Build Script

Use `build/dev/docker/build-and-start-debug.sh` to start the application in debug mode:

```bash
#!/bin/bash 
# ... build logic ...

# Override environment variables to force debug mode
export DEBUG=true
export DEBUG_PORT=9229

# Start with debug profile and explicit debug environment
DEBUG=true DEBUG_PORT=9229 docker-compose \
  --env-file ./build/dev/.env \
  --env-file ../.env-quanta \
  --profile pgadmin up --build
```

### Production Build Script

Use `build/dev/docker/build-and-start.sh` for regular development:

```bash
# Explicitly disable debug mode for production-like run
DEBUG=false docker-compose \
  --env-file ./build/dev/.env \
  --env-file ../.env-quanta \
  --profile pgadmin up --build
```

## VS Code Configuration

### Launch Configuration (`.vscode/launch.json`)

Create or update `.vscode/launch.json` with the following configurations:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Debug Quanta Server",
            "type": "node",
            "request": "launch",
            "program": "${workspaceFolder}/dist/server/AppServer.js",
            "preLaunchTask": "build-server",
            "runtimeExecutable": "/home/[username]/.nvm/versions/node/v22.2.0/bin/node",
            "env": {
                "CONFIG_FILE": "./build/dev/config.yaml",
                "QUANTA_ENV": "dev",
                "NODE_ENV": "development",
                "PATH": "/home/[username]/.nvm/versions/node/v22.2.0/bin:${env:PATH}"
            },
            "sourceMaps": true,
            "outFiles": [
                "${workspaceFolder}/dist/**/*.js"
            ],
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen",
            "skipFiles": [
                "<node_internals>/**"
            ],
            "restart": true,
            "stopOnEntry": false
        },
        {
            "name": "Debug Quanta Server (No Build)",
            "type": "node",
            "request": "launch",
            "program": "${workspaceFolder}/dist/server/AppServer.js",
            "runtimeExecutable": "/home/[username]/.nvm/versions/node/v22.2.0/bin/node",
            "env": {
                "CONFIG_FILE": "./build/dev/config.yaml",
                "QUANTA_ENV": "dev",
                "NODE_ENV": "development",
                "PATH": "/home/[username]/.nvm/versions/node/v22.2.0/bin:${env:PATH}"
            },
            "sourceMaps": true,
            "outFiles": [
                "${workspaceFolder}/dist/**/*.js"
            ],
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen",
            "skipFiles": [
                "<node_internals>/**"
            ],
            "restart": true,
            "stopOnEntry": false
        },
        {
            "name": "Attach to Quanta Docker Server",
            "type": "node",
            "request": "attach",
            "port": 9229,
            "address": "localhost",
            "localRoot": "${workspaceFolder}",
            "remoteRoot": "/app",
            "sourceMaps": true,
            "outFiles": [
                "${workspaceFolder}/dist/**/*.js"
            ],
            "skipFiles": [
                "<node_internals>/**"
            ],
            "restart": true
        }
    ]
}
```

**Important**: Replace `[username]` with your actual username and update the Node.js path to match your installation. Find your Node.js path with:
```bash
which node
```

### Tasks Configuration (`.vscode/tasks.json`)

Create or update `.vscode/tasks.json` for build automation:

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "build-server",
            "type": "shell",
            "command": "/home/[username]/.nvm/versions/node/v22.2.0/bin/yarn",
            "args": ["build:server"],
            "group": "build",
            "presentation": {
                "echo": true,
                "reveal": "silent",
                "focus": false,
                "panel": "shared",
                "showReuseMessage": true,
                "clear": false
            },
            "problemMatcher": "$tsc",
            "options": {
                "cwd": "${workspaceFolder}",
                "env": {
                    "PATH": "/home/[username]/.nvm/versions/node/v22.2.0/bin:${env:PATH}"
                }
            }
        },
        {
            "label": "build-all",
            "type": "shell",
            "command": "/home/[username]/.nvm/versions/node/v22.2.0/bin/yarn",
            "args": ["build"],
            "group": "build",
            "presentation": {
                "echo": true,
                "reveal": "always",
                "focus": false,
                "panel": "shared",
                "showReuseMessage": true,
                "clear": false
            },
            "problemMatcher": "$tsc",
            "options": {
                "cwd": "${workspaceFolder}",
                "env": {
                    "PATH": "/home/[username]/.nvm/versions/node/v22.2.0/bin:${env:PATH}"
                }
            }
        },
        {
            "label": "Start Debug Server",
            "type": "shell",
            "command": "./build/dev/docker/build-and-start-debug.sh",
            "group": "build",
            "presentation": {
                "echo": true,
                "reveal": "always",
                "focus": true,
                "panel": "new"
            },
            "options": {
                "cwd": "${workspaceFolder}"
            },
            "isBackground": true,
            "problemMatcher": {
                "pattern": {
                    "regexp": "^.*$",
                    "file": 1,
                    "location": 2,
                    "message": 3
                },
                "background": {
                    "activeOnStart": true,
                    "beginsPattern": "^.*Starting application.*$",
                    "endsPattern": "^.*Node.js debugger will be available.*$"
                }
            }
        }
    ]
}
```

## Debugging Workflow

### Method 1: Docker-based Debugging (Recommended)

This is the primary debugging method for full-stack development:

#### Step 1: Start Application in Debug Mode

```bash
./build/dev/docker/build-and-start-debug.sh
```

This script will:
- Build the TypeScript application
- Start Docker containers with debug mode enabled
- Expose Node.js debug port 9229 to localhost
- Display debug connection information

#### Step 2: Attach VS Code Debugger

1. Open VS Code with your Quanta project
2. Go to **Run and Debug** view (`Ctrl+Shift+D`)
3. Select **"Attach to Quanta Docker Server"** from the dropdown
4. Click the **play button** or press **F5**

#### Step 3: Set Breakpoints and Debug

1. Open any TypeScript file in the project:
   - Core platform: `server/*.ts`
   - Plugin server code: `plugins/*/server/*.ts`
   - Common utilities: `common/*.ts`

2. Click in the left margin to set breakpoints (red dots)

3. Trigger the code path that contains your breakpoints:
   - Make HTTP requests to API endpoints
   - Load pages that trigger server-side logic
   - Execute plugin functionality

4. When breakpoints are hit:
   - **Inspect variables**: Hover over variables or use Variables panel
   - **Step through code**: Use step controls (F10, F11, Shift+F11)
   - **Evaluate expressions**: Use Debug Console to run JavaScript
   - **View call stack**: See execution path in Call Stack panel

### Method 2: VS Code Task-based Debugging

You can also start the debug server directly from VS Code:

1. Open **Command Palette** (`Ctrl+Shift+P`)
2. Type "Tasks: Run Task"
3. Select **"Start Debug Server"**
4. Wait for the server to start
5. Use the **"Attach to Quanta Docker Server"** debug configuration

### Method 3: Local Server Debugging

For server-only development without Docker:

1. Build the application:
   ```bash
   yarn build
   ```

2. Start in debug mode:
   ```bash
   CONFIG_FILE="./build/dev/config.yaml" QUANTA_ENV=dev node --inspect=9229 dist/server/AppServer.js
   ```

3. Use the **"Debug Quanta Server"** or **"Debug Quanta Server (No Build)"** configurations

## Plugin Debugging

### Debugging Plugin Server Code

1. **Set breakpoints** in plugin TypeScript files:
   - `plugins/chat/server/ChatService.ts`
   - `plugins/docs/server/plugin.ts`
   - Any plugin-specific server logic

2. **Debug plugin initialization**:
   - Set breakpoints in plugin `init()` methods
   - Debug plugin registration and route setup

3. **Debug plugin API endpoints**:
   - Set breakpoints in plugin HTTP handlers
   - Test plugin-specific API calls

### Debugging Plugin Client Code

For client-side plugin debugging:

1. Use browser developer tools (F12)
2. Set breakpoints in compiled JavaScript (source maps available)
3. Debug React components and plugin UI logic

## Environment Variables for Debugging

### Key Environment Variables

- **`DEBUG`**: Set to `true` to enable debug mode
- **`DEBUG_PORT`**: Port for Node.js debugger (default: 9229)
- **`QUANTA_ENV`**: Environment setting (use "dev" for debugging)
- **`NODE_ENV`**: Node.js environment (use "development" for debugging)
- **`CONFIG_FILE`**: Path to configuration file

### Setting Environment Variables

**In Docker Compose**:
```yaml
environment:
  - DEBUG=true
  - DEBUG_PORT=9229
```

**In Shell Scripts**:
```bash
export DEBUG=true
export DEBUG_PORT=9229
```

**Inline with Commands**:
```bash
DEBUG=true DEBUG_PORT=9229 docker-compose up
```

## Debugging Features

### Source Map Support

- **TypeScript Debugging**: Set breakpoints directly in `.ts` files
- **Source Navigation**: Jump between original TypeScript and compiled JavaScript
- **Variable Inspection**: View TypeScript variable names and types

### Advanced Debugging

**Call Stack Navigation**:
- View complete execution path
- Navigate up and down the call stack
- Inspect variables at different stack levels

**Conditional Breakpoints**:
- Right-click on breakpoint to add conditions
- Break only when specific conditions are met
- Use expressions like `req.params.id === 'specific-value'`

**Debug Console**:
- Execute JavaScript expressions in current context
- Inspect complex objects and their properties
- Call functions and methods interactively

### Hot Restart

The debug configuration includes `"restart": true`, which allows:
- Automatic restart when code changes are detected
- Maintain breakpoints across restarts
- Faster development iteration

## Troubleshooting

### Common Issues and Solutions

#### Cannot Connect to Debugger

**Symptoms**: VS Code shows "Cannot connect to runtime process"

**Solutions**:
1. Ensure Docker container is running: `docker ps`
2. Check if debug port is exposed: `docker port quanta-dev`
3. Verify `DEBUG=true` environment variable is set
4. Check container logs: `docker logs quanta-dev`

#### Breakpoints Not Hitting

**Symptoms**: Breakpoints appear but don't trigger

**Solutions**:
1. Ensure TypeScript files are compiled: `yarn build`
2. Verify source maps are enabled in `tsconfig.json`
3. Check that the correct files are being executed
4. Restart the debug session

#### Source Maps Not Working

**Symptoms**: Breakpoints show in JavaScript files instead of TypeScript

**Solutions**:
1. Verify `sourceMaps: true` in debug configuration
2. Check `outFiles` pattern matches build output
3. Ensure TypeScript compiler generates source maps
4. Rebuild the application: `yarn build`

#### Path Configuration Issues

**Symptoms**: "Cannot find module" or path-related errors

**Solutions**:
1. Update Node.js path in VS Code configuration
2. Verify `localRoot` and `remoteRoot` settings
3. Check `PATH` environment variable includes Node.js
4. Use absolute paths in configuration

#### Docker Container Won't Start

**Symptoms**: Docker build or startup failures

**Solutions**:
1. Check Docker logs: `docker-compose logs quanta-app`
2. Verify `../.env-quanta` file exists
3. Ensure Docker volumes are accessible
4. Clean Docker state: `docker system prune`

### Debug Session Management

**Starting Debug Session**:
- Always start application first, then attach debugger
- Wait for "debugger available" message before attaching

**Stopping Debug Session**:
- Use VS Code stop button or `Shift+F5`
- Stop Docker containers: `./build/dev/docker/stop.sh`

**Restarting Debug Session**:
- Use restart button in VS Code debug toolbar
- Or stop and start both application and debugger

## Best Practices

### Development Workflow

1. **Use debug mode by default** during development
2. **Set meaningful breakpoints** rather than stepping through everything
3. **Use conditional breakpoints** for specific scenarios
4. **Leverage the debug console** for quick expression evaluation
5. **Test both plugin and core platform code paths**

### Performance Considerations

- Debug mode adds minimal overhead
- Source maps increase memory usage slightly
- Consider disabling debug for performance testing

### Security Considerations

- Debug port (9229) is only exposed to localhost
- Never enable debug mode in production
- Debug builds may include additional logging

## Integration with Development Tools

### VS Code Extensions

Recommended extensions for enhanced debugging:

- **TypeScript Importer**: Auto-import suggestions
- **Error Lens**: Inline error display
- **Thunder Client**: API testing within VS Code
- **Docker**: Container management

### Additional Tools

**Docker Desktop**: Visual container management
**Postman/Insomnia**: API endpoint testing
**Chrome DevTools**: Client-side debugging
**PostgreSQL Tools**: Database inspection during debugging

This debugging setup provides a comprehensive development environment that matches the production deployment architecture while offering full debugging capabilities for both the core platform and plugin development.