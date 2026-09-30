/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.(t|j)sx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json" }],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^next/image$": "<rootDir>/test/mocks/next-image.tsx",
    "^next/link$": "<rootDir>/test/mocks/next-link.tsx",
    "^next/navigation$": "<rootDir>/test/mocks/next-navigation.ts",
    "\\.(css|less|scss|sass)$": "<rootDir>/test/mocks/style.ts",
  },
  testMatch: ["<rootDir>/**/*.test.{ts,tsx}"],
  collectCoverageFrom: [
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "!**/layout.tsx",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "json", "lcov"],
};

module.exports = config;
