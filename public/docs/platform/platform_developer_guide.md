# Quanta Platform Developer Guide
This document explains the technical design of the Quanta `Core Platform` which is the common platform code that handles all non-plugin specific aspects. In other words, the code platform code is what manages the plugins and runs them, and provides the base layer framework for running applications as plugins.

## Overview
Quanta is a React-based web platform designed as a plugin-extensible framework for rapid application development. It provides a comprehensive foundation that eliminates common boilerplate code while offering a robust architecture for building scalable web applications. The project currently packages together two separate plugins which make up the "Quanta" app, which consists of document editing and chat capabilitities. Each of the two plugins of course rely on a large amount of common `core platform` code and capabilities that are shared. 

- **Quanta Docs Plugin**: A filesystem-based document editor with Jupyter Notebook-style interface
- **Quanta Chat Plugin**: A WebRTC-powered peer-to-peer chat application with optional server persistence

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

- **build**: Shell scripts used to build/run the app for `localhost`, `dev`, and `prod` deployments some of which have docker and non-Docker scripts for running either inside or outside of Docker. Note that the "Chat" plugin can ONLY run inside Docker, because it relies on using PostgreSQL to hold chat messages and other things.

- **server**: All server-side code, which is all in TypeScript, and runs an Express server.

- **client**: All client-side code, which is all in TypeScript, and runs in Web Browsers mostly as a SPA (Single Page App)

- **common**: Common code that is shared across both client and server. Note that we obviously cannot have any Express or server-side code in the common folder.

- **public**: Folder that is visible to web app (via URLs) at runtime, and also holds the `docs` folder which is where all technical and non-technical documentation can be found.

- **build**: This is a generated folder used to hold the runtime files, which is generated during a build. You can safely delete this folder, and it's never checked into 'git'.

### Files

- **tsconfig.*,vite, yarn, tailwind, postcss, package.json**: These are all files you will recognize in a project that's using Vite builder, TailwindCSS, and using TypeScript.

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

To see how the app starts and runs look at the `scripts` in [package.json](/package.json), but beware that the way we generally run the app is thru the scripts you'll find in the `build` folders (local, dev, proc).

The [Server Entry point](/server/AppServer.ts) is the main entry point of the server side code, which runs the Express Web App.

#### 2. Plugin Architecture

The system uses a plugin architecture that allows for modular application development. When the app starts it will read from the Docker compose file of course (for docker deploys), or else the appropriate `config*.yaml` file. From these configs it will know what plugins are defined, and it will then initialize plugins.

**Plugins**:

Each plugin should have an `plugin.ts` file in it's plugin folder which contains a class that derives from `IServerPlugin`. This Server Plugin interface has lifecycle methods that the plugin needs to implement to integrate and activate itself during startup of the web app.

In general Plugins are kept in separate dedicated subfolders on the client and on the server. For example, the `chat` plugin is in `/client/plugins/chat` project folder for client code and a `/server/plugins/chat` folder for server-side code. The other plugin subfolder you'll currently see, in addition to `chat` is `docs`. The plugin folder named `docs` is what contains the Document editor plugin. 

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

### Development Workflow

**Development Server**:
Run this from the project folder! (as current directory)

```bash
# Install dependencies
yarn install

# Start a development server (for non-docker run)
./build/dev/build-and-start.sh

--OR--
# Start development server (for docker)
./build/dev/docker-run.sh
```

### Plugin Development

**Creating a New Plugin**:
1. Create plugin directories: `client/plugins/[name]/` and `server/plugins/[name]/`
2. Implement plugin interfaces (`IClientPlugin`, `IServerPlugin`)
3. Add plugin configuration to `config.yaml`
4. Export plugin instances from `plugin.ts` files
5. Implement plugin-specific routes, pages, and components in `plugin.ts`

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
