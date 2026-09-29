import { defineConfig, env } from "prisma/config";
import { existsSync } from "node:fs";

if (existsSync("Back-end/.env")) process.loadEnvFile("Back-end/.env");

export default defineConfig({
  schema: "Back-end/prisma/schema.prisma",
  migrations: {
    path: "Back-end/prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});