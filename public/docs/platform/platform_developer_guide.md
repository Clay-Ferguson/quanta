# Quanta Platform Developer Guide
This document explains the technical design of the Quanta `Core Platform` which is the common platform code that handles all non-plugin specific aspects. In other words, the code platform code is what manages the plugins and runs them, and provides the base layer framework for running applications as plugins.

## Overview
Quanta is a React-based web platform designed as a plugin-extensible framework for rapid application development. It provides a comprehensive foundation that eliminates common boilerplate code while offering a robust architecture for building scalable web applications. The project currently packages together two separate plugins which make up the "Quanta" app, which consists of document editing and chat capabilitities. Each of the two plugins of course rely on a large amount of common `core platform` code and capabilities that are shared. 

- **Quanta Docs Plugin**: A VFS-based document editor with Jupyter Notebook-style interface
- **Quanta Chat Plugin**: A WebRTC-powered peer-to-peer chat application with server persistence

The goal is that we can theoretically run the Docs and/or Chat plugins independently. That means we could run the Docs plugin without the Chat plugin and vice versa if the need ever arises. This is one reason why they are implemented as plugins, although an additional goal of creating the `core platform` itself is that we can create brand new applications from scratch just by using the core platform plus one or more plugins, just like we've done for Quanta.

## Technology Stack

### Frontend Stack
- **TypeScript**: Strongly typed JavaScript for better development experience
- **React 19**: Modern React with hooks and functional components
- **Vite**: Fast build tool and development server
- **TailwindCSS + SCSS**: Utility-first CSS framework with custom styling
- **FontAwesome**: Icon library for consistent UI elements
- **React Markdown**: Markdown rendering with syntax highlighting
- **IndexedDB**: Client-side persistent storage

### Backend Stack
- **Node.js + Express**: RESTful API server with middleware support
- **TypeScript**: Consistent language across frontend and backend
- **PostgreSQL**: Database for server-side persistence
- **js-yaml**: Configuration management via YAML files

### Build & Development Tools
- **Yarn**: Package manager and build orchestration
- **ESLint**: Code linting with TypeScript support
- **PostCSS + Autoprefixer**: CSS processing pipeline

## Project Files & Folders

### Folders

- **build**: Shell scripts used to build/run the app for `localhost`, `dev`, and `prod` deployments some of which have docker and non-Docker scripts for running either inside or outside of Docker. Note that the "Chat" plugin can ONLY run inside Docker, because it relies on using PostgreSQL to hold chat messages and other things, and we only support PostgreSQL when inside docker. 
*Note: It would be trivial to get the app to run outside docker with PostgreSQL, but we just don't have any configurations that do that*

- **server**: All server-side code, which is all in TypeScript, and runs an Express server.

- **client**: All client-side code, which is all in TypeScript, and runs in Web Browsers mostly as a SPA (Single Page App)

- **common**: Common code that is shared across both client and server. Note that we obviously cannot have any Express or server-side code in the common folder.

- **public**: Folder that is visible to web app (via URLs) at runtime, and also holds the `docs` folder which is where all technical and non-technical documentation can be found.

- **build**: This is a generated folder used to hold the runtime files, which is generated during a build. You can safely delete this folder, and it's never checked into 'git'.

### Files

- **tsconfig.* , vite, yarn, tailwind, postcss, package.json**: These are all files you will recognize in a project that's using Vite builder, TailwindCSS, and using TypeScript.

## How to Run
The application now requires Docker for all deployments as it relies entirely on PostgreSQL for the VFS (Virtual File System) implementation. Both the Chat and Docs plugins require database persistence.

* For docker run: `/build/dev/docker/build-and-start.sh`

When you run the app it consists entirely of one or more activated 'plugins' which make up the deployed 'applications'. Both plugins (`chat` and `docs`) now require PostgreSQL and Docker to run, as all file operations use the VFS (Virtual File System) which is implemented in PostgreSQL. This paragraph will really only make complete sense once you've read the full Quanta Plugin docs.

## Debugging in VS Code

Quanta provides comprehensive debugging support for VS Code with TypeScript source maps, breakpoints, and step-by-step debugging capabilities. This section explains how to set up and use debugging for developers who have cloned the project from GitHub.

### Prerequisites

Before setting up debugging, ensure you have:
- **Node.js installed via nvm**: The project uses Node.js v22.2.0 or later
- **Yarn package manager**: Required for building the project
- **VS Code**: With TypeScript support enabled

### Setting Up VS Code Debug Configuration

#### 1. Create VS Code Configuration Directory

If the `.vscode` directory doesn't exist in your project root, create it:
```bash
mkdir .vscode
```

#### 2. Create Launch Configuration

Create `.vscode/launch.json` with the following content:

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
            "runtimeExecutable": "/home/clay/.nvm/versions/node/v22.2.0/bin/node",
            "env": {
                "CONFIG_FILE": "./build/dev/config.yaml",
                "QUANTA_ENV": "dev",
                "NODE_ENV": "development",
                "PATH": "/home/clay/.nvm/versions/node/v22.2.0/bin:${env:PATH}"
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
            "runtimeExecutable": "/home/clay/.nvm/versions/node/v22.2.0/bin/node",
            "env": {
                "CONFIG_FILE": "./build/dev/config.yaml",
                "QUANTA_ENV": "dev",
                "NODE_ENV": "development",
                "PATH": "/home/clay/.nvm/versions/node/v22.2.0/bin:${env:PATH}"
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
            "name": "Attach to Quanta Server",
            "type": "node",
            "request": "attach",
            "port": 9229,
            "address": "localhost",
            "localRoot": "${workspaceFolder}",
            "remoteRoot": "${workspaceFolder}",
            "sourceMaps": true,
            "outFiles": [
                "${workspaceFolder}/dist/**/*.js"
            ],
            "skipFiles": [
                "<node_internals>/**"
            ]
        }
    ]
}
```

**Important**: Update the `runtimeExecutable` and `PATH` values to match your actual Node.js installation path. You can find your Node.js path with:
```bash
which node
```

#### 3. Create Tasks Configuration

Create `.vscode/tasks.json` to handle the build process:

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "build-server",
            "type": "shell",
            "command": "/home/clay/.nvm/versions/node/v22.2.0/bin/yarn",
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
                    "PATH": "/home/clay/.nvm/versions/node/v22.2.0/bin:${env:PATH}"
                }
            }
        },
        {
            "label": "build-all",
            "type": "shell",
            "command": "/home/clay/.nvm/versions/node/v22.2.0/bin/yarn",
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
                    "PATH": "/home/clay/.nvm/versions/node/v22.2.0/bin:${env:PATH}"
                }
            }
        }
    ]
}
```

**Important**: Update the yarn command path and PATH environment variable to match your installation.

### Using the Debugger

#### Method 1: VS Code Integrated Debugging (Recommended)

1. **Set breakpoints**: Click in the left margin next to line numbers in any TypeScript file (`server/*.ts`, `plugins/*/server/*.ts`, `common/*.ts`)

2. **Start debugging**: 
   - Press `F5` or go to Run and Debug panel (`Ctrl+Shift+D`)
   - Select "Debug Quanta Server" from the dropdown
   - Click the green play button

3. **Debugging features**:
   - **Step controls**: Step over (`F10`), step into (`F11`), step out (`Shift+F11`)
   - **Variable inspection**: Hover over variables or use the Variables panel
   - **Call stack**: View execution path in the Call Stack panel
   - **Debug console**: Execute JavaScript expressions in current context
   - **Hot reload**: Debugger restarts automatically when files change

#### Method 2: Debug Without Building (Faster Iteration)

If you've already built the server and want to debug without rebuilding:
1. Select "Debug Quanta Server (No Build)"
2. Press `F5`

#### Method 3: Attach to Running Process

Similar to Java debugging, you can start the server first and then attach:

1. **Start server with debug mode**:
   ```bash
   # Build first
   yarn build
   
   # Start with debugging enabled
   CONFIG_FILE="./build/dev/config.yaml" QUANTA_ENV=dev node --inspect=9229 dist/server/AppServer.js
   ```

2. **Attach debugger**: Select "Attach to Quanta Server" and press `F5`

### Debugging Features

#### Source Map Support
- **TypeScript debugging**: Set breakpoints directly in `.ts` files
- **Plugin debugging**: Debug plugin code in `plugins/*/server/*.ts`
- **Common code debugging**: Debug shared code in `common/*.ts`

#### Environment Configuration
- **Development environment**: Uses `build/dev/config.yaml`
- **Environment variables**: Properly configured for local development
- **Plugin loading**: All configured plugins are loaded and debuggable

#### Advanced Debugging

**Plugin-Specific Debugging**:
- Set breakpoints in plugin server code (`plugins/chat/server/*.ts`, `plugins/docs/server/*.ts`)
- Debug plugin initialization and lifecycle methods
- Inspect plugin-specific state and data

**Common Code Debugging**:
- Debug shared utilities in `common/` directory
- Inspect cryptographic operations, utilities, and types
- Debug test code in `common/test/`

### Troubleshooting

#### Common Issues

**"Command not found" errors**:
- Ensure Node.js and Yarn paths are correctly specified in configurations
- Verify your nvm installation path matches the configuration

**Source maps not working**:
- Ensure TypeScript is configured with `"sourceMap": true`
- Verify `outFiles` pattern matches your build output directory

**Breakpoints not hitting**:
- Ensure you're setting breakpoints in TypeScript files, not compiled JavaScript
- Verify the build process completed successfully
- Check that the debug configuration is using the correct entry point

**Environment variable issues**:
- Verify `CONFIG_FILE` points to correct configuration
- Ensure `QUANTA_ENV` is set to appropriate environment
- Check that plugin configurations are properly loaded

For additional debugging support, refer to the [VS Code Node.js debugging documentation](https://code.visualstudio.com/docs/nodejs/nodejs-debugging).

## System Architecture

### Core Components

#### 1. Application Bootstrap

[Main client side entry point:](/client/main.tsx)

#### Server-Side Bootstrap 

To see how the app starts and runs look at the `scripts` in [package.json](/package.json), but beware that the way we generally run the app is thru the scripts you'll find in the `build` folders (local, dev, proc).

The [Server Entry point](/server/AppServer.ts) is the main entry point of the server side code, which runs the Express Web App.

#### 2. Plugin Architecture

The system uses a plugin architecture that allows for modular application development. When the app starts it will read from the Docker compose file of course (for docker deploys), or else the appropriate `config*.yaml` file. From these configs it will know what plugins are defined, and it will then initialize plugins.

**Plugins**:

Each plugin should have an `plugin.ts` file in it's plugin folder which contains a class that derives from `IServerPlugin`. This Server Plugin interface has lifecycle methods that the plugin needs to implement to integrate and activate itself during startup of the web app. Plugins are created/installed simply by adding the the plugin project folder to the '/plugins/' folder of the Quanta core platform.

**Plugin Installation**:

One of the key advantages of Quanta's plugin architecture is its simplicity. Installing a new plugin requires no configuration changes or complex deployment procedures - simply drop the plugin folder into the `/plugins/` directory and restart the application. The platform automatically discovers and loads any valid plugins during startup, making plugin management exceptionally straightforward. 

#### 3. ReactJS State Management

**Global State Architecture**:

All state that's part of the core platform is kept in [GlobalState](/client/GlobalState.tsx)

**Plugin State Extension**:

Each plugin can also have it's own type-safe "view" of the Global State as well by adding properties into the global state like, for example the [ChatGlobalState](/plugins/chat/client/ChatTypes.ts) file (where that path is relative to the Quanta Core Platform project root folder). We rely on a naming-convention based way of allowing all plugins to share parts of the same global state simply by requiringn each plugin to use the `Plugin Key` (same as plugin folder name) as the prefix for all global variables for a given plugin, to avoid naming conflicts. This naming convention lets us keep the simplest possible architecture by still having just one single GlobalState even when multiple different independent plugins are sharing contributions to it.

#### 4. HTTP API Architecture

From the Client side the HTTP REST calls are made thru the [Client Side REST API](/client/HttpClientUtil.ts)

**Authentication & Security**:

- **RFC 9421 HTTP Message Signatures**: Cryptographic request signing
- **Admin Authentication**: Server configuration-based admin access
- **Request Authentication**: User public key-based request validation
- **Timestamp Validation**: Request freshness verification (2-5 minute windows)

#### 5. Data Persistence

**Client-Side Storage (IndexedDB)**:

Persistance on the browser is done entirely thru the [Browser Persistence API](/client/IndexedDB.ts)

**Server-Side Storage (PostgreSQL)**:

PostgreSQL DB is available for the Dockerized deployments. The key file for Postgres connections [PGDB.ts](/server/PGDB.ts). Search for files named `*.sql` do learn about database schemas. There is SQL to generate the platform core tables, as well as the ability for each Plugin to create tables of their own.

### Plugin Development

**Creating a New Plugin**:
1. Create plugin directories: `plugins/[name]/client/` and `plugins/[name]/server/`
2. Implement plugin interfaces (`IClientPlugin`, `IServerPlugin`)
3. Create individual plugin configuration file (`plugins/[name]/config.yaml`)
4. Export plugin instances from `plugin.ts` files
5. Implement plugin-specific routes, pages, and components in `plugin.ts`

**Plugin Installation**:
Installing plugins is as simple as dropping the plugin folder into `/plugins/` and restarting the application. The system automatically discovers plugin in this folder and loads them. No build steps, configuration changes, or complex deployment procedures are required, other than to update the "plugins" entry in the config.yaml file, which lists which of the plugins you want to enable at runtime.

**Plugin Isolation**:
- **State Namespacing**: Use plugin key prefixes for global state variables
- **Route Isolation**: Each plugin manages its own HTTP endpoints
- **Component Separation**: Plugin-specific UI components and pages
- **Database Isolation**: Separate database managers per plugin

For more, about plugins see: [Extensions](./public/docs/extensions/extensions_developer_guide.md)

## Security Architecture

### Cryptographic Foundation

**Identity Management**:
- **secp256k1 Key Pairs**: ECDSA keypairs for user identity
- **Public Key Authentication**: Users identified by public key
- **Message Signing**: All authenticated requests cryptographically signed

**Request Authentication Flow**:
1. Client generates HTTP signature using private key
2. Server validates signature using provided public key
3. Timestamp validation prevents replay attacks
4. Admin endpoints use server-configured admin public key

### Data Protection

**Client-Side Security**:
- **Private Key Storage**: Encrypted storage in IndexedDB
- **Message Integrity**: Cryptographic signatures on all messages
- **XSS Protection**: React's built-in XSS prevention

**Server-Side Security**:
- **Request Validation**: Comprehensive input validation and sanitization
- **SQL Injection Prevention**: Parameterized queries throughout
- **File Upload Security**: Type validation and size limits
- **HTTPS Support**: TLS encryption for production deployments

## Development Guidelines

### Code Organization

**TypeScript Best Practices**:
- **Strict Type Checking**: Comprehensive type definitions
- **Interface-Driven Design**: Clear contracts between components
- **Error Handling**: Comprehensive try-catch blocks and error boundaries

**React Patterns**:
- **Hook-Based Components**: Modern functional component patterns
- **Custom Hooks**: Reusable stateful logic
- **Context for Global State**: Efficient state management
- **Component Composition**: Reusable and composable UI components

### Plugin Development Guidelines

**Plugin Structure**:
- **Single Responsibility**: Each plugin should have a clear, focused purpose
- **Loose Coupling**: Minimal dependencies between plugins
- **Configuration-Driven**: Use YAML configuration for plugin settings
- **Error Isolation**: Plugin errors should not crash the entire application

**State Management**:
- **Namespace Conventions**: Use plugin key as prefix for all global state variables
- **Local State**: Prefer local component state when global state isn't needed
- **Persistence Strategy**: Use IndexedDB for user data, server storage for shared data
