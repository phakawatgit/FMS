import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

let disconnectPromise: Promise<void> | undefined;

export function disconnectPrisma(): Promise<void> {
  disconnectPromise ??= prisma.$disconnect();
  return disconnectPromise;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void disconnectPrisma().catch((error: unknown) => {
      console.error("Failed to disconnect Prisma cleanly:", error);
      process.exitCode = 1;
    });
  });
}
