# Quanta Platform Development Guide

## Architecture Overview

Quanta is a React-based plugin-extensible web platform that provides a foundation for rapid application development. The core platform manages two main plugins: **Docs** (file system editor) and **Chat** (WebRTC messaging), each independently configurable via YAML.

For more see the README.md file in the root directory, which also includes links to the User Guides and Developer Guides, in the `/public/docs` directory.

### Key Components

- **Plugin System**: Each plugin implements `IClientPlugin` interface with `getKey()`, `init()`, and `getRoute()` methods
- **Global State**: Centralized React state using `GlobalState` interface with plugin-specific extensions via key prefixes
- **Configuration**: YAML-based config system with individual plugin configs (`/plugins/{name}/config.yaml`) and environment configs (`/build/{env}/config.yaml`) defining hosts and public folders
- **Dual Storage**: IndexedDB for client persistence, PostgreSQL for server-side data (chat requires DB)

## Development Workflows

### Build & Run Commands
```bash
# Development (local filesystem only, no DB)
./build/dev/build-and-start.sh

# Development with Docker (enables chat plugin)
./build/dev/docker-run.sh
```

### Build Process
- Client: `tsc -b && vite build` (builds React app)
- Server: `tsc -p server/tsconfig.json && npm run copy:sql` (builds Express server + copies SQL schemas)

### Plugin Development
- Client plugins: `/plugins/{plugin-name}/client/plugin.ts`
- Server plugins: `/plugins/{plugin-name}/server/plugin.ts`
- Each plugin defines pages, state extensions, and route handlers
- Schema files: `/plugins/{plugin-name}/server/schema.sql`
- Installation: Simply drop plugin folder with `config.yaml` into `/plugins/` and restart - automatic discovery and loading

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
- Individual plugin configs in `/plugins/{name}/config.yaml` with enabled property
- `Config.ts` loads via `CONFIG_FILE` env var and scans plugins directory
- Plugin discovery via individual config files with selective loading
- Public folders config for file system access

### Database Strategy
- Core platform: PostgreSQL optional (users table)
- Docs plugin: Can run without DB (local file system mode)
- Chat plugin: Requires PostgreSQL (messages, rooms, attachments)
- Environment variable `POSTGRES_HOST` controls DB initialization

### File Structure Conventions
- `/plugins/{name}/client/` - Client-side plugin code
- `/plugins/{name}/server/` - Server-side plugin code  
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

# Coding Tips
- Always use `import` statements for modules, avoid `require`.

# Testing
Quanta uses an embedded testing system that runs tests during application startup when configured to do so. For detailed information about the testing architecture, how to run tests, and how to write new tests, see the [Testing Guide](./TESTING.md).
