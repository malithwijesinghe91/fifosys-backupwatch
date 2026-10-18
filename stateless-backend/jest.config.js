/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  // The Autotask gateway/concurrency tests run real queues and back-off timers; on a busy machine (e.g. straight
  // after npm ci) they can pass 5 s and time out, which also upsets the next test. 30 s removes that flakiness.
  testTimeout: 30000,
  moduleDirectories: ['node_modules', '<rootDir>'],
  collectCoverageFrom: [
    'shared/**/*.ts',
    '!shared/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};