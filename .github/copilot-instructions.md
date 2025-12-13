# Quanta Platform Development Guide

## Architecture Overview

Quanta is a React-based plugin-extensible web platform for rapid application development. The core platform is minimal and unopinionated—it manages plugins (currently **Docs** for file editing and **Chat** for WebRTC messaging), each independently configurable via YAML.

**Critical Insight**: Quanta is NOT a monolithic app. The platform provides infrastructure (state, routing, auth, DB), while plugins define all user-facing features. The platform itself has no business logic beyond plugin orchestration.

### Core Components

**Plugin System** (dual-sided architecture):
- Client: Implement `IClientPlugin` (`/client/AppServiceTypes.ts`)
  - `getKey()`: Unique plugin identifier
  - `init(context)`: Initialize plugin state
  - `getRoute(gs, pageName)`: Return React component for page or null
  - `notify()`: Post-startup hook
  - `applyStateRules(gs)`: Enforce business rules on state changes
  - `restoreSavedValues(gs)`: Load persisted settings from IndexedDB
  - `getSettingsPageComponent()`, `getAdminPageComponent()`, `getUserProfileComponent()`: Inject into core pages
- Server: Implement `IServerPlugin` (`/server/ServerUtil.ts`)
  - `init(context)`: Register routes via `context.app` (Express instance)
  - `preProcessHtml(html, req)`: Modify index.html before serving (inject variables)
  - `notify(server)`: Post-startup hook (e.g., WebSocket server setup)
  - `onCreateNewUser(userProfile)`: Hook for user creation events

**Global State** (`/client/GlobalState.tsx`):
- Single React context for entire app, accessed via `useGlobalState()` hook
- Dispatch updates via `gd({type: 'actionName', payload: {...}})` function
- Plugins extend `GlobalState` interface using key prefixes (e.g., `docsFolder`, `chatActiveRoom`)
- Special feature: `setApplyStateRules()` callback allows plugins to enforce invariants on every state change
- Imperative access via `gs()` function returns latest state ref (use sparingly, prefer hooks)

**Routing Architecture** (state-based SPA):
- NO URL routing—navigation managed via `gs.pages` array (stack)
- Current page = `gs.pages[gs.pages.length - 1]`
- `PageRouter.tsx` iterates plugins calling `getRoute()`, falls back to core pages
- Back navigation: pop from `gs.pages` stack
- Example: `app.goToPage(DocsPageNames.treeViewer)` pushes page to stack

**Configuration System**:
- Environment configs: `/build/{env}/config.yaml` (host, port, security settings)
- Plugin configs: `/plugins/{name}/config.yaml` (name, key, description)
- `Config.ts` loads env config via `CONFIG_FILE` env var
- Auto-discovers plugins by scanning `/plugins/` directory, filters by `plugins` array in env config
- Supports Docker builds (checks `/dist/plugins/` if `/plugins/` missing)

**Dual Storage**:
- IndexedDB (client): User preferences, draft state, keys (`/client/IndexedDB.ts`)
- PostgreSQL (server): Persistent app data (users, messages, files)
- DB optional for core platform, required per-plugin (Chat needs it, Docs can run without)
- `POSTGRES_HOST` env var controls DB initialization

## Development Workflows

### Build & Run
```bash
# Docker dev environment (RECOMMENDED - includes PostgreSQL)
./build/dev/build-and-start.sh  # App at http://localhost:8000

# Docker dev with debug port 9229 exposed
./build/dev/build-and-start-debug.sh

# Non-Docker (requires manual PostgreSQL setup)
yarn build && yarn start

# Stop Docker containers
./build/dev/stop.sh
```

### Build Process Details
1. **Client**: `tsc -b && vite build` → `/dist/client/`
2. **Server**: `tsc -p server/tsconfig.json` → `/dist/server/`
3. **Post-build**: `./build/after-compile.sh` runs plugin-specific scripts (`/plugins/{name}/build/after-compile.sh`)
4. **Docker**: Copies entire `/dist/` into container, runs via `node dist/server/AppServer.js`

**Key Files**:
- `docker-compose.yaml`: Defines postgres, pgadmin (optional), quanta-app services
- `Dockerfile`: Multi-stage build, copies config based on `ENV` arg
- `/build/dev/.env`: Environment variables for Docker (ports, paths)
- `../.env-quanta`: Secrets file (passwords, admin keys) NOT in repo

### Plugin Development

**Creating a Plugin**:
1. Create `/plugins/my-plugin/` with structure:
   ```
   config.yaml                  # Required: name, key, description
   client/plugin.ts             # IClientPlugin implementation
   server/plugin.ts             # IServerPlugin implementation
   server/schema.sql            # Optional: PostgreSQL schema
   build/after-compile.sh       # Optional: post-build script
   ```
2. Add plugin key to `plugins` array in `/build/{env}/config.yaml`
3. Restart app—auto-discovered and loaded

**Plugin Discovery Flow**:
1. Server reads env config, gets `plugins: ['docs', 'chat']` array
2. `Config.scanPlugins()` reads `/plugins/*/config.yaml` files
3. Only loads plugins in whitelist array
4. `AppServer.ts` imports each via dynamic `import()`
5. Calls `plugin.init({app, serveIndexHtml})` on server plugins
6. Client loads via `AppService.loadPlugins()` using `PLUGINS` var injected into HTML

**Example Route Registration** (from `/plugins/docs/server/plugin.ts`):
```typescript
context.app.post('/api/docs/file/save', 
  httpServerUtil.verifyReqHTTPSignature, 
  asyncHandler(docMod.saveFile)
);
```

## Critical Patterns

### Error Handling
- **Server**: Wrap all async routes in `asyncHandler()` (`/server/ServerUtil.ts`)
- Prevents unhandled promise rejections from crashing server
- Use `handleError(error, res, message)` for consistent error responses
- Global handlers in `AppServer.ts` catch uncaught exceptions

### HTTP Request Authentication
- All API requests require HTTP signature verification (except endpoints with `AllowAnon`)
- Client signs requests using secp256k1 private key (`/common/Crypto.ts`)
- Server verifies via `httpServerUtil.verifyReqHTTPSignature` middleware
- Sets `req.userProfile` on authenticated requests
- Admin-only endpoints use `verifyAdminHTTPSignature` (checks against `adminPublicKey` config)

### IndexedDB Usage
- Wrap gets with default values: `await idb.getItem(DBKeys.docsViewWidth, 'medium')`
- Use `DBKeys` enum for namespacing (`/client/AppServiceTypes.ts`)
- Plugins extend enum for their keys (e.g., `DBKeys.docsEditMode`)

### PostgreSQL Patterns
- Connection pooling via `pg` library (`/server/db/PGDB.ts`)
- Schemas in `/server/schema.sql` and `/plugins/{name}/server/schema.sql`
- Initialize via `pgdb.initDb()` in `AppServer.ts`
- Transactional wrapper: `Transactional.ts` for atomic operations

### State Updates (Key Pattern)
```typescript
// In component
const gs = useGlobalState();
const dispatch = useGlobalDispatch();

// Update state
dispatch({ 
  type: 'updateDocs', 
  payload: { docsEditMode: true, docsFolder: '/new/path' } 
});

// State rules callback (runs on every dispatch)
applyStateRules(gs: GlobalState) {
  // Enforce invariants, e.g., clear selection when changing folders
  if (gs.docsFolder !== prevFolder) gs.docsSelItems?.clear();
}
```

## Environment Configuration

**Config Hierarchy**:
1. `docker-compose.yaml` sets `CONFIG_FILE=./config.yaml`
2. Dockerfile copies `/build/{env}/config.yaml` to `/app/dist/server/config.yaml`
3. `Config.ts` reads from `CONFIG_FILE` path
4. Merges plugin configs from `/plugins/*/config.yaml`

**Key Env Vars**:
- `QUANTA_ENV`: dev|local|prod (controls test execution, build opts)
- `POSTGRES_HOST`: If set, enables DB; if unset, DB features disabled
- `DEBUG`: If true, Node runs with `--inspect=0.0.0.0:9229`
- `CONFIG_FILE`: Path to YAML config (injected by Docker)

## Security Model

**Cryptographic Identity**:
- Each user has secp256k1 key pair stored in IndexedDB
- Public key = user ID (64-char hex string)
- Private key never leaves browser, used to sign all requests
- `/common/Crypto.ts`: `sign()`, `verify()`, `generateKeyPair()`

**Request Signing**:
- Client: `HttpClientUtil.makeSignedArgs()` creates signature valid for 5 minutes
- Signature covers timestamp + request body
- Server validates signature, rejects if expired or invalid
- Admin endpoints additionally check public key against `adminPublicKey` config

## Testing System

**Dual Testing Architecture** (see `TESTING.md`):
- **Server-side tests**: Run during app startup when `runTests: "y"` in config AND `QUANTA_ENV=dev`
  - Orchestrated via `ServerUtil.runAllTests()` in `/server/ServerUtil.ts`
  - Each plugin implements `IServerPlugin.runAllTests()` to execute its test suite
  - Example: Docs plugin runs VFS tests and REST endpoint tests
- **Client-side tests**: Run manually via button in Settings page (dev mode only)
  - Located in "Diagnostics" panel of SettingsPage.tsx
  - Executes browser-compatible tests (Crypto, CommonUtils)
  - Results displayed in Log Viewer page
- Uses custom `TestRunner` class (`/common/TestRunner.ts`) for reporting
- Test files: `*.test.ts` pattern
  - Common tests: `/common/test/*.test.ts` (can run client or server-side)
  - Plugin tests: `/plugins/{name}/server/test/*.test.ts` (server-side only)
- **Adding server tests**: (1) Create `*.test.ts` in plugin's `/server/test/` directory, (2) Import in plugin's `plugin.ts`, (3) Call from plugin's `runAllTests()` method
- **Adding client tests**: (1) Create browser-compatible `*.test.ts` in `/common/test/`, (2) Import in `SettingsPage.tsx`, (3) Add to "Run Tests" button handler 

## File Structure

```
/client/              React app, global state, routing
/server/              Express server, DB layer, config
/common/              Shared TypeScript (types, crypto, utils)
/plugins/{name}/      Plugin code (client/, server/, config.yaml)
/build/{env}/         Environment-specific configs and scripts
/dist/                Build output (gitignored)
/public/docs/         Static documentation served by app
```

## Integration Points

**Plugin-to-Platform Communication**:
- Shared global state (via key prefixes)
- IndexedDB namespacing (via `DBKeys` enum)
- Lifecycle hooks (`init`, `notify`, `onCreateNewUser`)

**Plugin-to-Plugin Communication**:
- Via global state (read other plugin's prefixed keys)
- Via HTTP endpoints (call other plugin's `/api/{plugin}/` routes)
- No direct imports between plugins (prevents coupling)

**Client-Server Communication**:
- REST APIs: `/api/{plugin}/{endpoint}` pattern
- WebSockets: Chat plugin uses `ws` library for real-time messaging
- File uploads: Express middleware with size limits (20MB default)
- **Archive Import**:
  - Endpoint: `/api/docs/archive/import`
  - Handled by: `ImportArchive.ts`
  - Supports: ZIP, TAR.GZ, TGZ
  - Logic:
    - Uploads archive via multipart/form-data
    - Extracts contents to temporary memory
    - Recursively creates directories using `vfs.mkdirEx` (handles parent creation)
    - Writes files using `vfs.writeFileEx` (auto-detects binary vs text based on extension)
    - Reorders imported directories to match alphabetical order using a two-pass ordinal update strategy (negative then positive) to avoid unique constraint violations.

## Coding Conventions

- **Imports**: Use ES6 `import` with `.js` extensions (TypeScript requirement for ES modules)
- **Async**: Always use `async/await`, never raw promises or callbacks
- **Error Handling**: Never throw without wrapping in `asyncHandler()` on server
- **Types**: Define in `/common/types/` for shared types, local for plugin-specific
- **State**: Never mutate `gs` directly—always dispatch new payload object
- **Logging**: Use `console.log` (Pino HTTP logging configured in `AppServer.ts`)

## Common Pitfalls

1. **Forgetting to extend DBKeys**: Plugin IndexedDB keys must be in enum or risk collisions
2. **Plugin load order**: Plugins loaded in array order from config—matters for HTML preprocessing
3. **State ref staleness**: `gs()` function returns ref, but hooks (`useGlobalState()`) auto-update
4. **Missing asyncHandler**: Unwrapped async routes will crash server on error
5. **Docker volumes**: PostgreSQL data in `../quanta-volumes/{env}/` outside repo (survives rebuilds)
6. **Port conflicts**: Dev uses 8000 (app), 5432 (postgres), 5050 (pgadmin)—check availability
7. **Plugin config sync**: Changing `config.yaml` requires restart to take effect
