# Testing Guide

Quanta uses an **embedded testing system** that runs tests during application startup when configured to do so. This approach provides seamless testing integration without requiring separate test runners or complex CI/CD configurations.

## Overview

The Quanta platform implements a custom embedded testing architecture where:

- Tests are executed during application startup when the `runTests` configuration is enabled
- All tests are orchestrated through a central test orchestrator
- Tests run using a custom `TestRunner` utility that provides consistent reporting
- The testing system works in both Docker and non-Docker environments

## Test Configuration

### Enabling Tests

Tests are controlled via the `runTests` configuration option in the environment-specific YAML configuration files:

- **Development**: `/build/dev/config.yaml` contains `runTests: "y"`
- **Production**: Tests are typically disabled in production configs

Example configuration:
```yaml
runTests: "y"  # Set to "y" to run embedded tests on server start
```

### Environment Requirements

- Tests only run in **development environment** (`QUANTA_ENV=dev`)
- The application must have the `runTests` config set to `"y"`
- Different test suites run based on available services (PostgreSQL presence affects which tests execute)

## Test Architecture

### Test Orchestration

The main test orchestration happens in `/server/app.test.ts`, which serves as the entry point for all testing:

```typescript
export async function runAllTests(): Promise<void> {
    console.log("Running embedded tests...");
    
    if (process.env.POSTGRES_HOST) {
        await runVfsTests();  // Virtual File System tests (requires PostgreSQL)
    } else {
        await runCommonUtilsTests();  // Common utility tests
        await runLfsTests();          // Local File System tests
    }
}
```

### Application Integration

The test execution is integrated into the main application server in `/server/AppServer.ts`:

```typescript
// Run tests if configured and in development environment ONLY
if (config.get("runTests") === "y" && process.env.QUANTA_ENV === "dev") {
    await runAllTests();
}
```

### TestRunner Utility

All tests use the common `TestRunner` class (`/common/TestRunner.ts`) which provides:

- Consistent test execution and error handling
- Standardized reporting with emojis and formatted output
- Global failure tracking across test suites
- Support for both throwing and non-throwing test modes

## Test Files

The following test files are currently part of the test suite:

### Core Tests
- `/tests/CommonUtils.test.ts` - Tests for common utility functions
- `/server/app.test.ts` - Main test orchestrator

### Plugin Tests

#### Docs Plugin Tests
- `/server/plugins/docs/IFS/test/lfs.test.ts` - Local File System tests
- `/server/plugins/docs/VFS/test/vfs.test.ts` - Virtual File System tests (requires PostgreSQL)

### Test File Naming Convention

All test files follow the pattern `*.test.ts` and are located either in:
- `/tests/` directory for core functionality tests
- `/server/plugins/{plugin-name}/test/` for plugin-specific tests

## Running Tests

### Development Environment

1. **Non-Docker Setup** (Local File System only):
   ```bash
   ./build/dev/build-and-start.sh
   ```

2. **Docker Setup** (Full functionality including chat):
   ```bash
   ./build/dev/docker-run.sh
   ```

### Test Execution Flow

1. Application starts up normally
2. If `runTests: "y"` and `QUANTA_ENV=dev`, tests begin execution
3. Test orchestrator determines which test suites to run based on environment
4. Each test suite uses `TestRunner` for execution and reporting
5. Global test results are accumulated and reported
6. Application continues normal startup after tests complete

### Test Output

The testing system provides rich console output including:

- 🧪 Individual test execution indicators
- ✅ Success counters
- ❌ Failure details with stack traces
- 📊 Comprehensive test suite summaries
- 🌍 Global failure tracking across all test suites
- 📝 List of completed test suites

Example output:
```
🧪 Running CommonUtils tests...
✅ Successful: 25
🎉 All tests passed!
🌍 Global failures: 0
📝 Suites Completed: CommonUtils, LFS
```

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

### Test Guidelines

- Use descriptive test names that explain what is being tested
- Leverage the assertion utilities from `CommonUtils.ts`
- Group related tests in logical test suites
- Use the `TestRunner` for consistent reporting
- Place tests in appropriate directories based on functionality

## Environment-Specific Testing

### Local File System (LFS) Tests
- Run when PostgreSQL is not available
- Test file system operations directly on the local file system
- Cover basic CRUD operations and file management

### Virtual File System (VFS) Tests  
- Run when PostgreSQL is available (Docker environment)
- Test the database-backed virtual file system
- Cover multi-user scenarios and advanced file operations

### Common Utility Tests
- Always run regardless of environment
- Test pure functions and utility methods
- Validate core application logic

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
- Verify that required services (like PostgreSQL) are available for relevant tests

### Docker-specific Issues
- Ensure Docker services are properly started
- Check that PostgreSQL container is healthy before running VFS tests
- Verify volume mounts and environment variables are correct

The embedded testing system provides a robust foundation for ensuring code quality while maintaining the simplicity of a single-command startup process.
