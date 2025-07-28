# Testing Setup for Quanta

This document describes the testing framework and best practices for the Quanta TypeScript/Node.js application. *NOTE: The below is an auto-generated file, created by Copilot Agent when we asked for inclusion of Jest in this app.*

## Overview

We use **Jest** as our primary testing framework, which is the most popular and widely-adopted testing solution for JavaScript/TypeScript projects.

## Dependencies

The following testing dependencies have been added to the project:

```json
{
  "devDependencies": {
    "jest": "^30.0.5",
    "@types/jest": "^30.0.0",
    "ts-jest": "^29.4.0",
    "jest-environment-node": "^30.0.5",
    "supertest": "^7.1.4",
    "@types/supertest": "^6.0.3"
  }
}
```

## Configuration

Jest is configured in `jest.config.js` with the following key settings:

- **TypeScript Support**: Uses `ts-jest` preset for TypeScript compilation
- **ES Modules**: Configured to handle ES modules (`"type": "module"` in package.json)
- **Test Location**: Tests are located in the `tests/` directory
- **Coverage**: Collects coverage from `server/`, `client/`, and `common/` directories
- **Setup**: Global test setup is configured in `tests/setup.ts`

## Available Test Scripts

```bash
# Run all tests
yarn test

# Run tests with coverage report
yarn test:coverage

# Run tests with verbose output
yarn test:verbose

# Run specific test file
yarn test CommonUtils.test.ts
```

## Test Organization

### Directory Structure

```
tests/
├── setup.ts              # Global test setup and utilities
├── types.d.ts             # TypeScript type declarations for tests
├── CommonUtils.test.ts    # Unit tests for CommonUtils
├── example.test.ts        # Example test patterns and best practices
└── [module-name].test.ts  # Other test files
```

### Naming Conventions

- Test files should end with `.test.ts` or `.spec.ts`
- Test files should be named after the module they test (e.g., `UserService.test.ts`)
- Test suites should use `describe()` blocks to group related tests
- Individual tests should use `it()` or `test()` functions

## Test Types

### 1. Unit Tests

Test individual functions and modules in isolation.

```typescript
import { formatDisplayName } from '../common/CommonUtils';

describe('CommonUtils', () => {
    describe('formatDisplayName', () => {
        it('should format names for display', () => {
            expect(formatDisplayName('01_hello_world')).toBe('Hello World');
            expect(formatDisplayName('02_advanced-topics')).toBe('Advanced Topics');
        });
    });
});
```

### 2. Integration Tests

Test how different parts of the application work together, especially Express routes.

```typescript
import request from 'supertest';
import express from 'express';

describe('API Integration Tests', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
    });

    it('should handle POST requests', async () => {
        app.post('/api/test', (req, res) => {
            res.json({ message: 'Success' });
        });

        const response = await request(app)
            .post('/api/test')
            .send({ data: 'test' })
            .expect(200);

        expect(response.body.message).toBe('Success');
    });
});
```

### 3. Mock Tests

Test code that depends on external services or complex dependencies.

```typescript
// Mock external dependencies
jest.mock('external-library', () => ({
    someFunction: jest.fn()
}));

describe('Service with Dependencies', () => {
    it('should handle mocked dependencies', () => {
        const mockFn = jest.fn().mockReturnValue('mocked result');
        // Test your code that uses the mocked function
    });
});
```

## Best Practices

### 1. Test Structure (AAA Pattern)

```typescript
it('should do something', () => {
    // Arrange: Set up test data and conditions
    const input = 'test input';
    const expected = 'expected output';

    // Act: Execute the function being tested
    const result = functionUnderTest(input);

    // Assert: Verify the result
    expect(result).toBe(expected);
});
```

### 2. Use Descriptive Test Names

```typescript
// Good
it('should return empty string when input is null or undefined', () => {});
it('should format currency with proper thousand separators', () => {});

// Avoid
it('should work', () => {});
it('test function', () => {});
```

### 3. Test Edge Cases

Always test:
- Empty inputs (`''`, `[]`, `{}`, `null`, `undefined`)
- Boundary values (min/max numbers, empty strings)
- Error conditions
- Async operation failures

### 4. Use beforeEach/afterEach for Setup and Cleanup

```typescript
describe('DatabaseService', () => {
    let mockDb: any;

    beforeEach(() => {
        mockDb = createMockDatabase();
    });

    afterEach(() => {
        mockDb.cleanup();
    });

    // Tests here...
});
```

### 5. Async Testing

```typescript
// For Promises
it('should handle async operations', async () => {
    const result = await asyncFunction();
    expect(result).toBe('expected');
});

// For error handling
it('should handle async errors', async () => {
    await expect(asyncFunctionThatFails()).rejects.toThrow('Error message');
});
```

## Common Jest Matchers

```typescript
// Equality
expect(value).toBe(4);                    // Strict equality (===)
expect(value).toEqual({a: 1, b: 2});      // Deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeGreaterThanOrEqual(3);
expect(value).toBeCloseTo(4.2, 1);

// Strings
expect(text).toMatch(/pattern/);
expect(text).toContain('substring');

// Arrays
expect(array).toHaveLength(3);
expect(array).toContain(item);

// Exceptions
expect(() => {
    throw new Error('Wrong');
}).toThrow('Wrong');

// Functions (mocks)
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenCalledTimes(3);
```

## Coverage Reports

Generate coverage reports to see how much of your code is tested:

```bash
yarn test:coverage
```

This creates a `coverage/` directory with HTML reports you can open in a browser.

**Note**: The `coverage/` directory is added to `.gitignore` and should not be committed to the repository. Coverage reports are generated artifacts that should be created fresh in each environment.

## Debugging Tests

### Running Specific Tests

```bash
# Run only tests matching a pattern
yarn test --testNamePattern="should format"

# Run only a specific test file
yarn test CommonUtils.test.ts

# Run tests in a specific directory
yarn test tests/unit/
```

### Debugging with VS Code

You can debug Jest tests directly in VS Code by:

1. Setting breakpoints in your test files
2. Using the "Run and Debug" panel
3. Selecting the Jest configuration
4. Running the debugger

## Continuous Integration

Tests should be run automatically in your CI/CD pipeline:

```bash
# In your CI script
yarn install
yarn test:coverage
```

## Examples

The `tests/` directory contains several example test files:

- `CommonUtils.test.ts` - Comprehensive unit tests for utility functions
- `example.test.ts` - Various testing patterns and examples
- `types.d.ts` - TypeScript definitions for test utilities

## Common Issues and Solutions

### 1. ES Module Issues

If you encounter ES module import errors, ensure your `jest.config.js` has proper `transformIgnorePatterns` configuration for problematic packages.

### 2. Type Declaration Issues

Add type declarations in `tests/types.d.ts` for custom test utilities or global objects.

### 3. Async Test Timeouts

Increase Jest timeout for slow async operations:

```typescript
jest.setTimeout(10000); // 10 seconds
```

## Getting Started

1. Look at the example tests in `tests/example.test.ts`
2. Create new test files following the naming convention
3. Aim for high code coverage (>80%) but focus on testing critical paths
4. Write tests as you develop new features (Test-Driven Development)

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [TypeScript with Jest](https://jestjs.io/docs/getting-started#using-typescript)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Supertest Documentation](https://github.com/ladjs/supertest)
