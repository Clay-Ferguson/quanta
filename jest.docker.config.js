export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  roots: ['<rootDir>/dist'],
  testMatch: [
    '<rootDir>/dist/server/tests/embedded-test.test.ts'
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
  // Use our embedded test setup file
  setupFilesAfterEnv: ['<rootDir>/dist/server/tests/setup.ts']
};
