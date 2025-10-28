# Testing Guide

Quanta uses a **dual testing system** that supports both server-side and client-side test execution:

- **Server-side tests**: Run automatically during application startup when configured
- **Client-side tests**: Run on-demand via a button in the Settings page (dev mode only)

This approach provides seamless testing integration without requiring separate test runners or complex CI/CD configurations.

## Overview

The Quanta platform implements a custom embedded testing architecture where:

- Server tests are executed during application startup when the `runTests` configuration is enabled
- Client tests can be manually triggered from the browser UI
- All tests use a custom `TestRunner` utility that provides consistent reporting
- The testing system works in both Docker and non-Docker environments
- Tests are organized by location: common tests (shared), and plugin-specific tests

## Test Configuration

### Enabling Server-Side Tests

Server-side tests are controlled via the `runTests` configuration option in the environment-specific YAML configuration files:

- **Development**: `/build/dev/config.yaml` contains `runTests: "y"`
- **Production**: Tests are typically disabled in production configs

Example configuration:
```yaml
runTests: "y"  # Set to "y" to run embedded tests when server starts
```

### Environment Requirements

- Server tests only run in **development environment** (`QUANTA_ENV=dev`)
- The application must have the `runTests` config set to `"y"`
- PostgreSQL database must be available for plugin tests (e.g., VFS operations in Docs plugin)

## Test Architecture

### Server-Side Test Orchestration 

Server-side test orchestration happens through the **plugin system** via `/server/ServerUtil.ts`:

1. `ServerUtil.runAllTests()` is called from `/server/AppServer.ts` during startup
2. This method iterates through all loaded plugins and calls each plugin's `runAllTests()` method
3. Each plugin is responsible for running its own test suites

```typescript
// From ServerUtil.ts
runAllTests = async (): Promise<void> => {
    console.log("Running embedded tests...");

    for (const plugin of this.pluginsArray) {
        await plugin.runAllTests(); 
    }
}
```

**Plugin Test Example** (from `/plugins/docs/server/plugin.ts`):
```typescript
async runAllTests(): Promise<void> {
    console.log("Running embedded tests...");
    await runVfsTests();           // Virtual File System tests
    await runRESTEndpointsTests(); // REST API tests
    return Promise.resolve();
}
```

### Client-Side Test Execution

Client-side tests run in the browser and are triggered manually from the Settings page:

1. Navigate to Settings page (only visible in dev mode when `gs.devMode` is true)
2. Scroll to "Diagnostics" panel
3. Click "Run Tests" button
4. Tests execute in the browser console
5. Results are displayed in the Log Viewer page

**Test Execution Flow** (from `/client/pages/SettingsPage.tsx`):
```typescript
<button 
    className="btn-primary mr-4"
    onClick={async () => {
        await runCryptoTests();
        await runCommonUtilsTests();
        await alertModal('Finished running tests. Switching to Log Viewer to show results.');
        app.goToPage(PageNames.logViewer);
    }}>
    Run Tests
</button>
```

### Application Integration

Server-side test execution is integrated into the main application server in `/server/AppServer.ts`:

```typescript
// Run tests if configured and in development environment ONLY
if (config.get("runTests") === "y" && process.env.QUANTA_ENV === "dev") {
    await svrUtil.runAllTests();
}
```

### TestRunner Utility

All tests use the common `TestRunner` class (`/common/TestRunner.ts`) which provides:

- Consistent test execution and error handling
- Standardized reporting with emojis and formatted output
- Global failure tracking across test suites
- Support for both throwing and non-throwing test modes

## Test Files

### Server-Side Test Files

Server-side tests are organized by plugin:

- **Core/Common Tests**: Tests in `/common/test/` directory
  - `Crypto.test.ts` - Cryptographic function tests (can run client or server-side)
  - `CommonUtils.test.ts` - Common utility tests (can run client or server-side)

- **Plugin-Specific Tests**: Tests in `/plugins/{plugin-name}/server/test/` directory
  - Docs plugin: `vfs.test.ts` (Virtual File System), `rest.test.ts` (REST endpoints)
  - Chat plugin: No tests currently implemented (returns resolved Promise)

Each plugin's `server/plugin.ts` implements the `IServerPlugin.runAllTests()` method to execute its test suite.

### Client-Side Test Files

Client-side tests are imported and executed directly in the browser:

- Tests from `/common/test/` can run on both client and server
- Currently executed: `Crypto.test.ts`, `CommonUtils.test.ts`
- Triggered via Settings page button in dev mode

### Test File Naming Convention

All test files follow the pattern `*.test.ts` and are located in:
- `/common/test/` for shared tests (can run on both client and server)
- `/plugins/{plugin-name}/server/test/` for plugin-specific server tests

## Running Tests

### Server-Side Test Execution Flow

1. Application starts up normally
2. If `runTests: "y"` in config AND `QUANTA_ENV=dev`, tests begin execution
3. `ServerUtil.runAllTests()` is called from `AppServer.ts`
4. Each loaded plugin's `runAllTests()` method is invoked sequentially
5. Plugin test suites use `TestRunner` for execution and reporting
6. Test results are logged to console
7. Application continues normal startup after tests complete

### Client-Side Test Execution Flow

1. User navigates to Settings page (dev mode only)
2. Scrolls to "Diagnostics" panel
3. Clicks "Run Tests" button
4. Tests execute in browser context:
   - `runCryptoTests()` - Cryptographic function tests
   - `runCommonUtilsTests()` - Common utility tests
5. Results are logged to browser console
6. User is redirected to Log Viewer page to see results

**Note**: Client-side tests can only be run when `gs.devMode` is true, which makes the Diagnostics panel visible.

## Writing Tests

### Test Structure

Tests should follow this pattern:

```typescript
import { TestRunner } from '../common/TestRunner.js';

export async function runTests() {
    console.log("🚀 Starting [SuiteName] tests...");
    
    const testRunner = new TestRunner("SuiteName");
    
    await testRunner.run("test description", async () => {
        // Test implementation
        assert(condition, "Assertion message");
    });
    
    testRunner.report();
}
```

### Adding New Tests

**For Server-Side Plugin Tests**:
1. Create test file in `/plugins/{plugin-name}/server/test/*.test.ts`
2. Export a `runTests` function
3. Import it in your plugin's `server/plugin.ts`
4. Call it from the plugin's `runAllTests()` method

Example (from Docs plugin):
```typescript
// In /plugins/docs/server/plugin.ts
import { runTests as runVfsTests } from './test/vfs.test.js';
import { runTests as runRESTEndpointsTests } from './test/rest.test.js';

async runAllTests(): Promise<void> {
    console.log("Running embedded tests...");
    await runVfsTests();
    await runRESTEndpointsTests();
    return Promise.resolve();
}
```

**For Client-Side Tests**:
1. Create test file in `/common/test/*.test.ts` (must be compatible with browser)
2. Export a `runTests` function
3. Import it in `/client/pages/SettingsPage.tsx`
4. Add it to the test execution sequence in the "Run Tests" button handler

Example:
```typescript
// In SettingsPage.tsx
import { runTests as runMyTests } from '@common/test/MyTests.test.js';

// In the button onClick handler
onClick={async () => {
    await runCryptoTests();
    await runCommonUtilsTests();
    await runMyTests(); // Add your test here
    await alertModal('Finished running tests...');
    app.goToPage(PageNames.logViewer);
}}
```

### Test Guidelines

- Use descriptive test names that explain what is being tested
- Leverage the assertion utilities from `CommonUtils.ts`
- Group related tests in logical test suites
- Use the `TestRunner` for consistent reporting
- Place tests in appropriate directories based on functionality
- **Client-side tests**: Must not use Node.js-specific APIs (fs, path, etc.) - browser-compatible only
- **Server-side tests**: Can use full Node.js API and database access

## Test Categories

### Common Tests (Client & Server)
- **Crypto.test.ts**: Cryptographic functions (signing, verification, key generation)
- **CommonUtils.test.ts**: Pure utility functions and data manipulation

### Plugin-Specific Tests (Server Only)

**Docs Plugin**:
- **vfs.test.ts**: Virtual File System tests - PostgreSQL-backed file operations, CRUD operations, multi-user scenarios
- **rest.test.ts**: REST API endpoint tests - file save/load, authentication, error handling

**Chat Plugin**:
- Currently no tests implemented (placeholder returns resolved Promise)

## Best Practices

- **Keep tests fast**: Tests run during application startup, so they should execute quickly
- **Use meaningful assertions**: Provide clear error messages for failed assertions
- **Test in isolation**: Each test should be independent and not rely on other tests
- **Clean up resources**: Ensure tests don't leave behind test data or affect the application state
- **Document complex test logic**: Add comments explaining complex test scenarios

## Troubleshooting

### Tests Not Running
- Verify `runTests: "y"` in your config file
- Ensure `QUANTA_ENV=dev` is set
- Check that you're running the development configuration

### Test Failures
- Review the detailed error output in the console
- Check the global failure count to see if failures are isolated or systematic
- Verify that PostgreSQL database is available and properly configured

### Docker-specific Issues
- Ensure Docker services are properly started
- Check that PostgreSQL container is healthy and accessible
- Verify volume mounts and environment variables are correct

The embedded testing system provides a robust foundation for ensuring code quality while maintaining the simplicity of a single-command startup process.
