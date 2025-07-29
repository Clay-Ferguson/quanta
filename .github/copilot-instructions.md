# Quanta Platform Development Guide

## Architecture Overview

Quanta is a React-based plugin-extensible web platform that provides a foundation for rapid application development. The core platform manages two main plugins: **Docs** (file system editor) and **Chat** (WebRTC messaging), each independently configurable via YAML.

For more see the README.md file in the root directory, which also includes links to the User Guides and Developer Guides, in the `/public/docs` directory.

### Key Components

- **Plugin System**: Each plugin implements `IClientPlugin` interface with `getKey()`, `init()`, and `getRoute()` methods
- **Global State**: Centralized React state using `GlobalState` interface with plugin-specific extensions via key prefixes
- **Configuration**: YAML-based config system (`/build/{env}/config.yaml`) defining plugins, hosts, and public folders
- **Dual Storage**: IndexedDB for client persistence, PostgreSQL for server-side data (chat requires DB)

## Development Workflows

### Build & Run Commands
```bash
# Development (local filesystem only, no DB)
./build/dev/build-and-start.sh

# Development with Docker (enables chat plugin)
./build/dev/docker-run.sh

# Production deployment
./build/prod/docker-run-prod.sh
```

### Build Process
1. Client: `tsc -b && vite build` (builds React app)
2. Server: `tsc -p server/tsconfig.json && npm run copy:sql` (builds Express server + copies SQL schemas)
3. Environment controlled by `QUANTA_DEV` flag in vite config

### Plugin Development
- Client plugins: `/client/plugins/{plugin-name}/plugin.ts`
- Server plugins: `/server/plugins/{plugin-name}/plugin.ts`
- Each plugin defines pages, state extensions, and route handlers
- Schema files: `/server/plugins/{plugin-name}/schema.sql`

## Project Patterns

### State Management
```typescript
// Plugin state extends global state with key prefixes
interface DocsGlobalState extends GlobalState {
    docsFolder?: string;
    docsEditMode?: boolean;
    // ... docs-specific state
}
```

### Routing Pattern
- SPA with page stack in `gs.pages` array (last = current page)
- `PageRouter.tsx` checks plugins first via `getRoute()`, then core pages
- No URL routing - state-driven navigation with back button support

### Configuration System
- Environment-specific YAML configs in `/build/{env}/`
- `Config.ts` loads via `CONFIG_FILE` env var
- Plugins array defines which capabilities are enabled
- Public folders config for file system access

### Database Strategy
- Core platform: PostgreSQL optional (users table)
- Docs plugin: Can run without DB (local file system mode)
- Chat plugin: Requires PostgreSQL (messages, rooms, attachments)
- Environment variable `POSTGRES_HOST` controls DB initialization

### File Structure Conventions
- `/client/plugins/{name}/` - Client-side plugin code
- `/server/plugins/{name}/` - Server-side plugin code  
- `/common/types/` - Shared TypeScript interfaces
- `/public/docs/` - Technical documentation
- `/build/{env}/` - Environment-specific build scripts and configs

## Integration Points

### Plugin Communication
- Shared global state via React context
- IndexedDB persistence with `DBKeys` enum for namespacing
- HTTP endpoints follow `/api/{plugin}/{endpoint}` pattern
- WebSocket communication for real-time features (chat)

### File System Integration
- VFS (Virtual File System) mode: PostgreSQL-backed
- LFS (Local File System) mode: Direct file access
- Configurable via `public-folders` in YAML config
- File uploads handled via Express middleware with size limits

### Security Model
- Cryptographic identity with secp256k1 key pairs
- Message signing for chat integrity
- Public key-based user identification
- Admin key configuration for elevated privileges

## Unit Testing

We use 'Jest' for testing  and we have our test cases in the 'test' folder. See file [TESTING.md](./build/TESTING.md) for details how we do unit tests. For tests that require a PostgreSQL database, we use Docker to create an isolated test environment, which is done by running the script `./build/test/docker-run.sh`.

# Coding Tips

- Always use `import` statements for modules, avoid `require`.
