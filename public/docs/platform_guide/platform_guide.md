# Quanta Platform Developer Guide

*Note: The official name for the Quanta File System viewer/editor is "Quanta FS" but we almost always refer to it simply as "Quanta", although this is admittedly confusing because Quanta is the same name as the platform itself.*

## Overview

Quanta is a modern React-based web platform designed as a plugin-extensible framework for rapid application development. It provides a comprehensive foundation that eliminates common boilerplate code while offering a robust architecture for building scalable web applications.

The platform currently includes two main applications:

- **Quanta FS (Docs)**: A filesystem-based document editor with Jupyter Notebook-style interface
- **Callisto (Chat)**: A WebRTC-powered peer-to-peer chat application with optional server persistence

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
- **WebSocket (ws)**: Real-time communication for WebRTC signaling
- **js-yaml**: Configuration management via YAML files
- **Multer**: File upload handling

### Build & Development Tools
- **Yarn**: Package manager and build orchestration
- **ESLint**: Code linting with TypeScript support
- **PostCSS + Autoprefixer**: CSS processing pipeline
- **HTTPS/HTTP**: Production-ready SSL support

## System Architecture

### Core Components

#### 1. Application Bootstrap

**Client-Side Initialization (`client/main.tsx`)**:
```typescript
// React app initialization with global state management
createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <GlobalStateProvider> 
            <AppServiceConnector />
            <PageRouter />
            <AlertModalComp />
            <ConfirmModalComp />
            <PromptModalComp />
        </GlobalStateProvider>
    </StrictMode>
);

// Delayed initialization ensures proper React state setup
setTimeout(() => {
    app.init();
}, 250)
```

**Server-Side Bootstrap (`server/AppServer.ts`)**:
```typescript
// Express server with plugin architecture
const app = express();

// Plugin initialization before route setup
await svrUtil.initPlugins(plugins, {app, serveIndexHtml});

// Static file serving
app.use(express.static("./dist", { index: false }));

// Plugin route finalization
await svrUtil.finishRoutes(plugins, {app, serveIndexHtml});

// Server startup with HTTPS/HTTP support
const server = SECURE === 'y' ? https.createServer({key, cert}, app) : http.createServer(app);
server.listen(PORT);

// Plugin notification of server readiness
await svrUtil.notifyPlugins(plugins, server);
```

#### 2. Plugin Architecture

The system uses a sophisticated plugin architecture that allows for modular application development:

**Plugin Lifecycle**:
1. **Loading**: Plugins are dynamically imported during application startup
2. **Initialization**: Each plugin's `init()` method is called with shared context
3. **Route Setup**: Plugins register their HTTP endpoints and page routes
4. **Finalization**: Default routes and fallback handlers are established
5. **Notification**: Plugins are notified when the server is fully ready

**Client Plugin Interface (`IClientPlugin`)**:
```typescript
interface IClientPlugin {
    getKey(): string;                                    // Unique plugin identifier
    init(context: any): Promise<void>;                   // Plugin initialization
    notify(): Promise<void>;                             // Server ready notification
    applyStateRules(gs: GlobalState): void;              // State validation rules
    restoreSavedValues(gs: GlobalState): Promise<void>;  // State restoration
    getRoute(gs: GlobalState, pageName: string): ReactElement | null; // Page routing
    getSettingsPageComponent(): ReactElement | null;     // Settings UI component
    getAdminPageComponent(): ReactElement | null;        // Admin UI component
    getUserProfileComponent(profileData: UserProfile): ReactElement | null; // Profile UI
    goToMainPage(): void;                                // Navigation handler
}
```

**Server Plugin Interface (`IServerPlugin`)**:
```typescript
interface IServerPlugin {
    init(context: any): void;        // Register routes and middleware
    finishRoute(context: any): void; // Setup fallback routes
    notify(server: any): void;       // Handle server startup notification
}
```

#### 3. State Management

**Global State Architecture**:
```typescript
// Centralized state with plugin extensibility
interface GlobalState {
    keyPair?: KeyPairHex;           // Cryptographic identity
    pages?: Array<string>;          // Navigation stack
    userName?: string;              // User identity
    userAvatar?: FileBase64Intf;    // Profile image
    headerExpanded?: boolean;       // UI state
    collapsedPanels?: Set<string>;  // Panel visibility
    devMode?: boolean;              // Development mode
    // Plugin-specific state with key prefixes
}

// State management with React Context + Reducer
const [state, dispatch] = useReducer(globalReducer, initialState);

// Global accessor functions for non-React contexts
function gs(): GlobalState { return globalStateRef.current; }
function gd(action: GlobalAction): GlobalState { /* dispatch logic */ }
```

**Plugin State Extension**:
```typescript
// Plugins extend the global state interface
interface ChatGlobalState extends GlobalState {
    chatRoom?: string;
    chatConnecting?: boolean;
    chatMessages?: Array<ChatMessage>;
    chatContacts?: Array<Contact>;
}

// Type-safe state access for plugins
export function useGlobalState(): ChatGlobalState {
    return useGlobalStateBase() as ChatGlobalState;
}
```

#### 4. HTTP API Architecture

**Authentication & Security**:
- **RFC 9421 HTTP Message Signatures**: Cryptographic request signing
- **Admin Authentication**: Server configuration-based admin access
- **Request Authentication**: User public key-based request validation
- **Timestamp Validation**: Request freshness verification (2-5 minute windows)

**Middleware Stack**:
```typescript
// Admin-only endpoints
app.post('/api/admin/create-room', httpServerUtil.verifyAdminHTTPSignature, handler);

// User-authenticated endpoints  
app.post('/api/rooms/:roomId/send-messages', httpServerUtil.verifyReqHTTPSignature, handler);

// Public endpoints (no authentication)
app.get('/api/rooms/:roomId/message-ids', handler);
```

**API Patterns**:
- **RESTful Design**: Standard HTTP methods and status codes
- **JSON Communication**: Structured request/response format
- **Error Handling**: Centralized error response formatting
- **File Uploads**: Multipart form data support for attachments

#### 5. Data Persistence

**Client-Side Storage (IndexedDB)**:
```typescript
// Structured key-value storage for offline capabilities
class IndexedDB {
    async init(dbName: string, storeName: string, version: number): Promise<void>
    async setItem(key: string, value: any): Promise<void>
    async getItem<T>(key: string, defaultValue?: T): Promise<T>
    async removeItem(key: string): Promise<void>
    async clear(): Promise<void>
}

// Common storage keys
enum DBKeys {
    keyPair = "keyPair",           // User cryptographic identity
    userName = "userName",          // Display name
    userAvatar = "userAvatar",     // Profile image
    headerExpanded = "headerExpanded" // UI preferences
}
```

**Server-Side Storage (PostgreSQL)**:
```typescript
// Plugin-specific database managers
class DBManager implements DBManagerIntf {
    async get<T>(sql: string, ...params: any[]): Promise<T | undefined>
    async all<T>(sql: string, ...params: any[]): Promise<T[]>  
    async run(sql: string, ...params: any[]): Promise<any>
}

// Database schemas managed per plugin
// Chat: rooms, messages, attachments, users, blocked_users
// Docs: No database persistence (filesystem-based)
```

#### 6. Real-Time Communication

**WebRTC Integration**:
- **Peer-to-Peer**: Direct browser-to-browser communication
- **WebSocket Signaling**: Server-mediated connection establishment
- **ICE/STUN/TURN**: NAT traversal and connection management
- **Data Channels**: File transfer and messaging

**WebSocket Architecture**:
```typescript
// Server-side WebSocket handling
class WebRTCServer {
    async init(host: string, port: string, server: any): Promise<void>
    // Handle peer discovery, signaling, and room management
}

// Client-side WebRTC management  
class WebRTC {
    async connect(): Promise<void>
    // Manage peer connections and data channels
}
```

#### 7. Configuration Management

**YAML-Based Configuration**:
```yaml
# config.yaml / config-dev.yaml
host: "localhost"
port: "8080" 
secure: "n"
adminPublicKey: "..."
defaultPlugin: "chat"
desktopMode: "y"

plugins:
  - key: "chat"
    name: "Callisto Chat"
  - key: "docs" 
    name: "Quanta Docs"

publicFolders:
  - key: "user-guide"
    name: "User Guide"
    path: "./public/docs"
```

**Runtime Configuration Access**:
```typescript
class Config {
    get(keyPath: string): any                    // Get configuration value
    getPublicFolderByKey(key: string): any      // Get folder configuration
    getPublicFolders(): any[]                   // Get all public folders
}
```

## Build System & Development

### Development Workflow

**Development Server**:
```bash
# Install dependencies
yarn install

# Start development server (auto-reload)
./run-dev.sh
# - Starts Vite dev server on port 5173
# - Starts Express server with hot reload
# - Enables source maps and debugging
```

**Production Build**:
```bash
# Build for production
./run-prod.sh  
# - TypeScript compilation
# - Vite production build
# - Asset optimization and minification
# - HTTPS certificate handling
```

### Project Structure

```
quanta/
├── client/                     # Frontend React application
│   ├── components/            # Reusable UI components
│   ├── pages/                 # Core application pages
│   ├── plugins/               # Plugin implementations
│   ├── styles/                # SCSS and Tailwind styles
│   ├── AppService.ts          # Main application service
│   ├── GlobalState.tsx        # State management
│   └── main.tsx              # Application entry point
├── server/                    # Backend Express application
│   ├── plugins/              # Server-side plugin implementations
│   ├── AppServer.ts          # Express server setup
│   ├── Config.ts             # Configuration management
│   └── HttpServerUtil.ts     # Authentication middleware
├── common/                    # Shared TypeScript types
│   ├── types/                # Interface definitions
│   └── Crypto.ts            # Cryptographic utilities
├── public/                    # Static assets and documentation
├── dist/                      # Built application output
├── config.yaml               # Runtime configuration
└── package.json              # Dependencies and scripts
```

### Plugin Development

**Creating a New Plugin**:
1. Create plugin directories: `client/plugins/[name]/` and `server/plugins/[name]/`
2. Implement plugin interfaces (`IClientPlugin`, `IServerPlugin`)
3. Add plugin configuration to `config.yaml`
4. Export plugin instances from `init.ts` files
5. Implement plugin-specific routes, pages, and components

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

## Performance & Scalability

### Client-Side Optimization

**React Performance**:
- **Functional Components**: Modern React patterns with hooks
- **State Optimization**: Efficient global state management
- **Code Splitting**: Plugin-based code organization
- **Asset Optimization**: Vite's optimized build pipeline

**Storage Efficiency**:
- **IndexedDB**: Efficient client-side persistence
- **Message Deduplication**: Smart message storage strategies
- **Image Optimization**: Base64 encoding with size limits

### Server-Side Efficiency

**Network Efficiency**:
- **WebRTC P2P**: Reduced server load through peer-to-peer communication
- **HTTP/2 Support**: Modern protocol support
- **Static Asset Serving**: Efficient file serving with caching

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