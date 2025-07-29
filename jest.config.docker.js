export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/server', '<rootDir>/client', '<rootDir>/common'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }],
  },
  // Allow ES modules to be transformed
  transformIgnorePatterns: [
    'node_modules/(?!(open|is-wsl|is-docker)/)'
  ],
  collectCoverageFrom: [
    'server/**/*.ts',
    'client/**/*.ts',
    'common/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: true,
  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@client/(.*)$': '<rootDir>/client/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
    '^@common/(.*)$': '<rootDir>/common/$1'
  },
  // Docker-specific settings
  forceExit: true,
  detectOpenHandles: true,
  // Longer timeout for Docker environment
  testTimeout: 30000,
  // Set max workers for container environment
  maxWorkers: 2
};
