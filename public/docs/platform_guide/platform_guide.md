# Quanta Platform Developer Guide

*Note: `Quanta` is the name of the primary plugin as well as the name of the platform itself, so whever it's not obvious from context we'll use the terminology `Quanta App` or `Quanta Plugin` vs `Quanta Platform`*

## Overview

Quanta Platform is a React-based web platform designed as a plugin-extensible framework for rapid application development. It provides a comprehensive foundation that eliminates common boilerplate code while offering a robust architecture for building scalable web applications.

The platform currently includes two main applications:

- **Quanta**: A filesystem-based document editor with Jupyter Notebook-style interface
- **Callisto**: A WebRTC-powered peer-to-peer chat application with optional server persistence

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

## How to Run

There are two major categories of configurations for this app: Docker or non-Docker. The only reason you'd want to run the app outside of Docker would be when you're running a private version where you're using the Quanta Plugin to edit files locally and/or to use Quanta as a menuing system (app launcher). Details of the local file editing and app launcher are explained in the Quanta-specific documentation (not this file)

We can run the app using either Docker or non-Docker deployments. We have the shell scripts named `run-*.sh` and `docker-run-*sh` in the project root which are somewhat self-explanatory. They end in `dev` for (development), `local` for a local deployment (non-server install), and `prod` for production servers which activate HTTPS support.

Any configuration that uses PostgreSQL requires the Docker version becuause we're only setup to access PostgreSQL as a docker service.

When you run the app it consists entirely of one or more activated 'plugins' which make up the deployed 'applications'. The only combination that you can run that doesn't require Postgres (and therefore Docker), is when you're running only the `docs` (i.e. `Quanta`) plugin, and running in LFS mode (Local File System). In other words we only have two plugins currently which are `chat` and `docs` and the chat app always requires Docker to run, and the `docs` will require Docker if you're using any VFS (Virtual File System) roots, because the VFS is implemented in Postgres. This paragraph will really only make complete sense once you've read the full Quanta Plugin docs.

## System Architecture

### Core Components

#### 1. Application Bootstrap

[Main client side entry point:](/client/main.tsx)

#### Server-Side Bootstrap 

To see how the app starts and runs look at the `scripts` in [package.json](/package.json)

The [Server Entry point](/server/AppServer.ts) is the main entry point of the server side code.

When the app starts it will read from the Docker compose file of course, as well as the appropriate `config*.yaml` file. From these configs it will know what plugins are defined, and it will then initialize plugins.

#### 2. Plugin Architecture

The system uses a plugin architecture that allows for modular application development:

**Server-side Plugin Lifecycle**:

Each plugin should have an `init.ts` file in it's plugin folder which contains a class that derives from `IServerPlugin`. This Server Plugin interface has lifecycle methods that the plugin needs to implement to integrate and activate itself during startup of the web app.

In general Plugins are kept in separate dedicated subfolders on the client and on the server. For example, the `chat` plugin (called Callisto as it's product name) there's a `/client/plugins/chat` project folder for client code and a `/server/plugins/chat` folder for server-side code. The other plugin subfolder you'll currently see, in addition to `chat` is `docs`. The plugin folders named `docs` is what contains the Quanta App/Plugin. The Quanta Plugin is called `docs` because it's primarily a File System-based document editor and wiki system.

#### 3. ReactJS State Management

**Global State Architecture**:

All state that's part of the core platform is kept in [GlobalState](/client/GlobalState.tsx)

**Plugin State Extension**:

Each plugin can also have it's own type-safe "view" of the Global State as well by adding properties into the global state like, for example the [ChatGlobalState](/client/plugins/chat/ChatTypes.ts). We rely on a naming-convention based way of allowing all plugins to share parts of the same global state simply by requiringn each plugin to use the `Plugin Key` (same as plugin folder name) as the prefix for all global variables for a given plugin, to avoid naming conflicts. This naming convention lets us keep the simplest possible architecture by still having just one single GlobalState even when multiple different independent plugins are sharing contributions to it.

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

#### 6. Real-Time Communication

todo: We need to move this into 'Chat' plugin because it's not part of core platform.

**WebRTC Integration**:
- **Peer-to-Peer**: Direct browser-to-browser communication
- **WebSocket Signaling**: Server-mediated connection establishment
- **ICE/STUN/TURN**: NAT traversal and connection management
- **Data Channels**: File transfer and messaging

#### 7. Configuration Management

**YAML-Based Configuration**:
```yaml
# config.yaml / config.yaml
host: "localhost"
port: "8080" 
secure: "n"
adminPublicKey: "..."
defaultPlugin: "chat"
desktopMode: "y"

plugins:
  - key: "chat"
    name: "Callisto"
  - key: "docs" 
    name: "Quanta"

publicFolders:
  - key: "user-guide"
    name: "User Guide"
    path: "./public/docs"
```

## Build System & Development

### Development Workflow

**Development Server**:
```bash
# Install dependencies
yarn install

# Start development server (auto-reload)
./run-dev.sh
```

**Production Build**:
```bash
# Build for production
./docker-run-prod.sh  
```

### Plugin Development

**Creating a New Plugin**:
1. Create plugin directories: `client/plugins/[name]/` and `server/plugins/[name]/`
2. Implement plugin interfaces (`IClientPlugin`, `IServerPlugin`)
3. Add plugin configuration to `config.yaml`
4. Export plugin instances from `init.ts` files
5. Implement plugin-specific routes, pages, and components in `init.ts`

**Plugin Isolation**:
- **State Namespacing**: Use plugin key prefixes for global state variables
- **Route Isolation**: Each plugin manages its own HTTP endpoints
- **Component Separation**: Plugin-specific UI components and pages
- **Database Isolation**: Separate database managers per plugin

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

This architecture provides a solid foundation for building modern web applications with plugin extensibility, strong security, and excellent developer experience. The plugin system allows for rapid development of new features while maintaining code organization and system stability.