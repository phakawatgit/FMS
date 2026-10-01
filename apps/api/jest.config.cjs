/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: false,
        tsconfig: {
          target: "ES2022",
          module: "CommonJS",
          moduleResolution: "Node",
          esModuleInterop: true,
          strict: true,
        },
      },
    ],
  },
  maxWorkers: 1,
  testTimeout: 30_000,
};
