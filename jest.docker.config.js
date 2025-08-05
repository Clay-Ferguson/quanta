export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  cache: false,
  roots: ['<rootDir>/dist/server/tests'],
  testMatch: [
    '**/*.test.ts'
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
  transformIgnorePatterns: [
    'node_modules/(?!(open|is-wsl|is-docker)/)'
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: true,
  // Ensure console output is visible during tests
  silent: false,
  // Use our embedded test setup file
  setupFilesAfterEnv: ['<rootDir>/dist/server/tests/setup.ts']
};
