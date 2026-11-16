import { defineConfig } from "drizzle-kit";
import path from "path";

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL (ou POSTGRES_URL) não encontrada. Configure a string de conexão do Supabase no arquivo .env.",
  );
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
