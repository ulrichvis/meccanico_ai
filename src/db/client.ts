import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

const globalDatabase = globalThis as typeof globalThis & {
  meccanicoDatabase?: PrismaClient;
};

export class DatabaseConfigurationError extends Error {
  constructor() {
    super(
      "DATABASE_URL is required for database access. Add the Supabase pooled connection string to .env.local.",
    );
    this.name = "DatabaseConfigurationError";
  }
}

export function getDatabaseClient(): PrismaClient {
  if (globalDatabase.meccanicoDatabase) {
    return globalDatabase.meccanicoDatabase;
  }

  if (!env.DATABASE_URL) {
    throw new DatabaseConfigurationError();
  }

  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  const client = new PrismaClient({ adapter });

  if (env.NODE_ENV !== "production") {
    globalDatabase.meccanicoDatabase = client;
  }

  return client;
}
