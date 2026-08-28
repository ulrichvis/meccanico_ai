import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

const globalDatabase = globalThis as typeof globalThis & {
  meccanicoDatabase?: PrismaClient;
};

const databaseCaCertificatePath = resolve(
  process.cwd(),
  "certificates",
  "supabase-prod-ca-2021.crt",
);

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

  const ca = readFileSync(databaseCaCertificatePath, "utf8");
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    ssl: {
      ca,
      rejectUnauthorized: true,
    },
  });
  const client = new PrismaClient({ adapter });

  if (env.NODE_ENV !== "production") {
    globalDatabase.meccanicoDatabase = client;
  }

  return client;
}
