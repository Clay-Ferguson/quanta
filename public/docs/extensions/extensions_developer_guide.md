# Plugin Development Guide

TODO: This entire document needs to be reviewed. It was AI Generated, and may be very outdated at this point.

This guide provides comprehensive instructions for software developers on how to create and integrate new plugins (extensions) into the Quanta web application.

## Overview

The Quanta web application uses a plugin-based architecture that allows developers to extend functionality through modular components. Each plugin consists of both client-side and server-side components that integrate seamlessly with the application's core systems.

## Plugin Installation

Installing a new plugin in Quanta is extremely simple - just drop the plugin folder into the `/plugins/` directory and restart the application. The platform automatically discovers and loads any valid plugins during startup.

**Installation steps:**
1. Copy your plugin folder (e.g., `myplugin/`) into the `/plugins/` directory
2. Ensure your plugin has the required structure: `plugins/myplugin/client/plugin.ts` and `plugins/myplugin/server/plugin.ts`
3. Restart the Quanta application
4. The plugin will be automatically discovered and loaded

No configuration files need to be modified, no build processes need to be run, and no complex deployment procedures are required. This "drop-and-go" approach makes plugin management exceptionally straightforward.

## Plugin Architecture

### Directory Structure

Plugins are organized in two main directories:

Quanta uses a plugin-based architecture where functionality is divided into:

- **Client-side plugins**: `plugins/{plugin-name}/client/`
- **Server-side plugins**: `plugins/{plugin-name}/server/`

Each plugin has its own directory containing an `plugin.ts` file that exports the plugin implementation.

In the folder structure below it's important to know that `chat` is the folder name (and extension identifier) for the Quanta Chat App, and `docs` is the folder name (and extension identifier) for the Quanta App. 

You may wonder why `docs` was chosen as the extension name for a File Manager, and the reason is that indeed Quanta is more of a document editor than it is a file manager, because what it does that's unique is that it melds together the two concepts of 'file system' and 'document managers', in the same sort of way that Jupyter Notebooks is a melding together the concept of a cell-based spreadsheet and a document. Quanta is very similar to Jupyter Notebooks in this regard. However, importantly, Quanta uses individual files as it's 'cells' whereas Jupyter uses a single monolighic JSON file to hold 'cells' of content.


## Plugin Interfaces

### IClientPlugin Interface

All client-side plugins must implement the `IClientPlugin` interface:

```typescript
export interface IClientPlugin {
    getKey(): string; 
    init(context: any): Promise<void>;
    notify(): Promise<void>;
    applyStateRules(gs: GlobalState): void;
    restoreSavedValues(gs: GlobalState): Promise<void>;
    getRoute(gs: GlobalState, pageName: string): React.ReactElement | null;
    getSettingsPageComponent(): React.ReactElement | null;
    getAdminPageComponent(): React.ReactElement | null;
    getUserProfileComponent(profileData: UserProfile): React.ReactElement | null;
    goToMainPage(): void;
}
```

#### Method Descriptions

- **`getKey()`**: Returns a unique string identifier for the plugin (e.g., 'chat', 'docs')
- **`init(context)`**: Initializes the plugin with access to IndexedDB and shared global state
- **`notify()`**: Called after application initialization is complete
- **`applyStateRules(gs)`**: Applies plugin-specific business rules to the global state
- **`restoreSavedValues(gs)`**: Restores plugin-specific saved values from IndexedDB
- **`getRoute(gs, pageName)`**: Returns React components for plugin-specific pages
- **`getSettingsPageComponent()`**: Returns component to display on the settings page
- **`getAdminPageComponent()`**: Returns component to display on the admin page
- **`getUserProfileComponent(profileData)`**: Returns component for user profile display
- **`goToMainPage()`**: Navigates to the plugin's main page

### IServerPlugin Interface

All server-side plugins must implement the `IServerPlugin` interface:

```typescript
export interface IServerPlugin {
    init(context: any): void;
    notify(server: any): void;
}
```

#### Method Descriptions

- **`init(context)`**: Initializes the plugin with Express app instance and routing functions
- **`notify(server)`**: Called when server startup is complete, provides access to server instance

## Configuration

### Plugin Configuration Files

The application uses two types of configuration:

#### 1. Individual Plugin Config Files

Each plugin has its own `config.yaml` file in its plugin directory (`/plugins/{plugin-name}/config.yaml`) that defines:

- **Plugin Metadata**: Name, key, description, and version
- **Enabled Status**: Boolean flag to enable/disable the plugin
- **Plugin-Specific Settings**: Any custom configuration for the plugin

Example plugin config file (`/plugins/chat/config.yaml`):
```yaml
name: "Quanta Chat"
key: "chat"
description: "WebRTC-powered peer-to-peer chat application"
version: "1.0.0"
enabled: true
```

**Plugin Discovery**: The application automatically scans the `/plugins/` directory for these config files during startup and only loads plugins where `enabled` is not `false`.

#### 2. Environment Config Files

The application also supports multiple environment configuration files (e.g., `config.yaml`, `config-prod.yaml`) in the `/build/{env}/` directories that define:

- **Database Configuration**: PostgreSQL connection settings
- **Public Folders**: File system access permissions  
- **Host Settings**: Server host and port configuration

#### Default Plugin
```yaml
defaultPlugin: "chat"  # The plugin that loads by default
```

**Note**: The `key` field in individual plugin configs corresponds to the directory name and the value returned by `getKey()`.

## Creating a New Plugin

### Step 1: Create Directory Structure

1. Create directories for your plugin:
   ```bash
   mkdir -p plugins/myplugin/client
   mkdir -p plugins/myplugin/server
   ```

### Step 2: Implement Client Plugin

Create `plugins/myplugin/client/plugin.ts`:

```typescript
import React from 'react';
import { IClientPlugin } from "../../AppServiceTypes";
import { GlobalState } from '../../GlobalState';
import { idb } from '../../IndexedDB';

class MyClientPlugin implements IClientPlugin {
    getKey(): string {
        return 'myplugin';
    }

    async init(context: any) {
        console.log('Initializing My Plugin...');
        const gs = context.initGs;
        // Initialize plugin-specific state
        gs.myPluginData = {};
    }

    async notify(): Promise<void> {
        console.log('My plugin notified of startup completion');
    }

    applyStateRules(gs: GlobalState): void {
        // Apply any business rules
    }

    async restoreSavedValues(gs: GlobalState): Promise<void> {
        // Restore saved data from IndexedDB
    }

    getRoute(gs: GlobalState, pageName: string): React.ReactElement | null {
        // Return React components for your pages
        return null;
    }

    getSettingsPageComponent(): React.ReactElement | null {
        return null;
    }

    getAdminPageComponent(): React.ReactElement | null {
        return null;
    }

    getUserProfileComponent(profileData: any): React.ReactElement | null {
        return null;
    }

    goToMainPage(): void {
        // Navigate to your main page
    }
}

export const plugin = new MyClientPlugin();
```

### Step 3: Implement Server Plugin

Create `plugins/myplugin/server/plugin.ts`:

```typescript
import { IServerPlugin } from "../../ServerUtil.js";
import { config } from "../../Config.js";

const defaultPlugin = config.get("defaultPlugin");

class MyServerPlugin implements IServerPlugin {
    init(context: any) {
        console.log('init my plugin...');
        this.initRoutes(context.app, context.serveIndexHtml);
    }

    private initRoutes(app: any, serveIndexHtml: any) {
        // Define your API routes
        app.get('/api/myplugin/data', this.getData);
        app.post('/api/myplugin/save', this.saveData);

        // Serve your main page if this is the default plugin
        if (defaultPlugin === "myplugin") {
            app.get('/', serveIndexHtml("MyMainPage"));
        }
    }

    notify(server: any) {
        // Called when server startup is complete
    }

    private getData = (req: any, res: any) => {
        // Handle GET requests
        res.json({ data: 'example' });
    }

    private saveData = (req: any, res: any) => {
        // Handle POST requests
        res.json({ success: true });
    }
}

export const plugin = new MyServerPlugin();
```

### Step 4: Create Plugin Configuration

Create a `config.yaml` file in your plugin directory (`/plugins/myplugin/config.yaml`):

```yaml
name: "My Plugin"
key: "myplugin"
description: "Description of what my plugin does"
version: "1.0.0"
enabled: true
```

**Plugin Installation**: Simply drop the plugin folder into `/plugins/` and restart the application. The system will automatically discover your plugin's config file and load it if `enabled` is `true`.

## Plugin State Management

### Global State

Plugins can extend the global state by adding properties prefixed with their plugin key:

```typescript
interface MyPluginGlobalState extends GlobalState {
    myPluginData?: any;
    myPluginSettings?: any;
}
```

### IndexedDB Integration

Use the provided `idb` service to persist plugin data:

```typescript
// Save data
await idb.setItem('myPlugin.settings', settings);

// Retrieve data
const settings = await idb.getItem('myPlugin.settings', defaultValue);
```

## Page and Component Integration

### Creating Pages

Create React components for your plugin's pages and return them from `getRoute()`:

```typescript
getRoute(gs: GlobalState, pageName: string): React.ReactElement | null {
    switch (pageName) {
        case 'myMainPage':
            return React.createElement(MyMainPageComponent);
        case 'mySettingsPage':
            return React.createElement(MySettingsPageComponent);
        default:
            return null;
    }
}
```

### Settings Integration

Provide a settings component that will be displayed on the main settings page:

```typescript
getSettingsPageComponent(): React.ReactElement | null {
    return React.createElement(MySettingsComponent);
}
```

## API Route Patterns

### Standard Route Patterns

Follow these conventions for API routes:

- **GET routes**: For retrieving data
  ```typescript
  app.get('/api/myplugin/resource', handler);
  ```

- **POST routes**: For creating/updating data
  ```typescript
  app.post('/api/myplugin/resource', handler);
  ```

### Authentication

Use the provided HTTP signature verification for secure endpoints:

```typescript
import { httpServerUtil } from "../../HttpServerUtil.js";

// Admin-only endpoint
app.post('/api/myplugin/admin-action', 
         httpServerUtil.verifyAdminHTTPSignature, 
         handler);

// User-authenticated endpoint
app.post('/api/myplugin/user-action', 
         httpServerUtil.verifyReqHTTPSignature, 
         handler);
```

## Plugin Lifecycle

### Initialization Order

1. **Server Plugin `init()`**: Sets up routes and services
2. **Client Plugin `init()`**: Initializes client-side state
3. **Client Plugin `restoreSavedValues()`**: Restores persisted data
4. **Client Plugin `notify()`**: Post-initialization notifications
6. **Server Plugin `notify()`**: Server startup complete

### Plugin Communication

Plugins communicate through:

- **Global State**: Shared state object accessible to all plugins
- **Event System**: Using the global dispatch function `gd()`
- **Direct Method Calls**: Through the plugin registry

## Best Practices

### Code Organization

- Keep plugin logic modular and self-contained
- Use TypeScript for better type safety
- Follow the existing naming conventions
- Organize components in logical subdirectories

### State Management

- Prefix all global state properties with your plugin key
- Use IndexedDB for persistent storage
- Implement proper error handling for async operations

### Error Handling

- Wrap async operations in try-catch blocks
- Use the provided error handling utilities
- Log errors appropriately for debugging

### Performance

- Lazy-load components when possible
- Minimize global state pollution
- Use React best practices for component optimization

## Example: Minimal Plugin

Here's a complete minimal plugin example:

**Client (`plugins/example/client/plugin.ts`)**:
```typescript
import React from 'react';
import { IClientPlugin } from "../../AppServiceTypes";

class ExampleClientPlugin implements IClientPlugin {
    getKey() { return 'example'; }
    async init(context: any) { console.log('Example plugin init'); }
    async notify() { }
    applyStateRules(gs: any) { }
    async restoreSavedValues(gs: any) { }
    getRoute(gs: any, pageName: string) { return null; }
    getSettingsPageComponent() { return null; }
    getAdminPageComponent() { return null; }
    getUserProfileComponent(profileData: any) { return null; }
    goToMainPage() { }
}

export const plugin = new ExampleClientPlugin();
```

**Server (`plugins/example/server/plugin.ts`)**:
```typescript
import { IServerPlugin } from "../../ServerUtil.js";

class ExampleServerPlugin implements IServerPlugin {
    init(context: any) { console.log('Example server plugin init'); }
    notify(server: any) { }
}

export const plugin = new ExampleServerPlugin();
```

## Debugging and Testing

### Logging

Use console logging for debugging:
```typescript
console.log('Plugin debug info:', data);
console.error('Plugin error:', error);
```

### Development Mode

Enable development mode in the application for additional debugging features and logs.

### Testing

Test your plugin by:
1. Adding it to the configuration
2. Starting the development server
3. Verifying initialization logs
4. Testing plugin functionality through the UI

This completes the comprehensive plugin development guide. Follow these patterns and conventions to create robust, well-integrated plugins for the Quanta web application.