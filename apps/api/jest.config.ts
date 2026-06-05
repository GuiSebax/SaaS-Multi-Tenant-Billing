import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  // Matches *.spec.ts but excludes *.integration.spec.ts
  testRegex: '(?<!\\.integration)\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@database/(.*)$': '<rootDir>/database/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@saas-platform/shared$': '<rootDir>/../../packages/shared/src',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};

export default config;
