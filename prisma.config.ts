import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Keep this optional so schema validation and client generation work before
    // local Supabase credentials are added. Database commands still require it.
    url: process.env.DIRECT_URL?.trim() ?? "",
  },
});
