/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: [
    '<rootDir>/packages/**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        target: 'es2020',
        lib: ['es2020'],
        types: ['jest', 'node']
      }
    }]
  },
  moduleNameMapper: {
    '^@pkg/(.*)$': '<rootDir>/packages/$1/src'
  },
  collectCoverageFrom: [
    'packages/**/*.ts',
    '!packages/**/*.test.ts',
    '!**/node_modules/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};