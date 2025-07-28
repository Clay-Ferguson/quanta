// Test setup file - runs before all tests
// This is where you can configure global test settings, mock setup, etc.

// Example: Set up global test timeouts
jest.setTimeout(10000);

// Example: Mock console methods during tests to reduce noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
    console.error = jest.fn();
    console.warn = jest.fn();
});

afterAll(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
});

// Example: Global test utilities or mocks can be defined here
(global as any).testUtils = {
    createMockUser: () => ({
        id: 'test-user-id',
        publicKey: 'test-public-key',
        displayName: 'Test User'
    })
};
