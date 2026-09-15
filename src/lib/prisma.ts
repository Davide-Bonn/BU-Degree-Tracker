import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: appendPoolParams(process.env.DATABASE_URL ?? ""),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Add connection pool params if not already present */
function appendPoolParams(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit"))
      u.searchParams.set("connection_limit", process.env.NODE_ENV === "production" ? "10" : "5");
    if (!u.searchParams.has("pool_timeout"))
      u.searchParams.set("pool_timeout", "30");
    return u.toString();
  } catch {
    return url;
  }
}
