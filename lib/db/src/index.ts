import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { count } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export function getDatabaseUrl(): string | undefined {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.SUPABASE_DB_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ];
  for (const candidate of candidates) {
    if (
      candidate &&
      candidate.trim() !== "" &&
      !candidate.includes("[SEU-PROJECT-REF]") &&
      !candidate.includes("[YOUR-PASSWORD]")
    ) {
      return candidate.trim();
    }
  }
  return undefined;
}

export function hasDatabaseUrl(): boolean {
  return Boolean(getDatabaseUrl());
}

function isLocalDatabaseUrl(url: string): boolean {
  return (
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("@postgres:") ||
    url.includes("@db:")
  );
}

const connectionString = getDatabaseUrl();

export const pool: pg.Pool | null = connectionString
  ? new Pool({
      connectionString,
      max: process.env.VERCEL ? 3 : 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: isLocalDatabaseUrl(connectionString)
        ? false
        : { rejectUnauthorized: false },
    })
  : null;

export const db: NodePgDatabase<typeof schema> = pool
  ? drizzle(pool, { schema })
  : (new Proxy(
      {},
      {
        get() {
          throw new Error(
            "DATABASE_URL não configurada. Configure a variável DATABASE_URL da Supabase.",
          );
        },
      },
    ) as unknown as NodePgDatabase<typeof schema>);

const INIT_SCHEMA_SQL = `
DO $$ BEGIN
  CREATE TYPE product_category AS ENUM ('feed', 'medicine', 'supplies', 'equipment', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE movement_direction AS ENUM ('in', 'out');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE finance_kind AS ENUM ('payable', 'receivable');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE finance_status AS ENUM ('pending', 'settled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE poultry_lot_kind AS ENUM ('layers', 'broilers', 'chicks', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE poultry_movement_direction AS ENUM ('in', 'out');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE poultry_exit_reason AS ENUM ('sale', 'transfer', 'mortality', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS farm_products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category product_category NOT NULL,
  unit TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
  minimum_quantity DOUBLE PRECISION,
  unit_cost_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES farm_products(id) ON DELETE RESTRICT,
  direction movement_direction NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  note TEXT,
  source_type TEXT,
  source_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_finance_entries (
  id SERIAL PRIMARY KEY,
  kind finance_kind NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  due_date DATE NOT NULL,
  status finance_status NOT NULL DEFAULT 'pending',
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS farm_poultry_lots (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  kind poultry_lot_kind NOT NULL,
  received_at DATE NOT NULL,
  source TEXT,
  breed TEXT,
  age_weeks INTEGER,
  initial_count INTEGER NOT NULL,
  current_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_poultry_movements (
  id SERIAL PRIMARY KEY,
  lot_id INTEGER NOT NULL REFERENCES farm_poultry_lots(id) ON DELETE RESTRICT,
  direction poultry_movement_direction NOT NULL,
  quantity INTEGER NOT NULL,
  movement_date DATE NOT NULL,
  counterparty TEXT,
  reason poultry_exit_reason,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_feed_recipes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_feed_recipe_ingredients (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES farm_feed_recipes(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES farm_products(id) ON DELETE RESTRICT,
  quantity_kg DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS farm_feeding_logs (
  id SERIAL PRIMARY KEY,
  lot_id INTEGER NOT NULL REFERENCES farm_poultry_lots(id) ON DELETE RESTRICT,
  recipe_id INTEGER NOT NULL REFERENCES farm_feed_recipes(id) ON DELETE RESTRICT,
  lot_label_snapshot TEXT NOT NULL,
  recipe_name_snapshot TEXT NOT NULL,
  quantity_kg DOUBLE PRECISION NOT NULL,
  total_cost_cents INTEGER,
  feeding_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

function isoDateOffset(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

export async function seedMvpDatabase(force = false): Promise<boolean> {
  if (!pool) return false;

  const [{ value: existingProducts }] = await db
    .select({ value: count() })
    .from(schema.productsTable);

  if (existingProducts > 0 && !force) {
    return false;
  }

  await db.transaction(async (tx) => {
    if (force && existingProducts > 0) {
      await tx.delete(schema.feedingLogsTable);
      await tx.delete(schema.feedRecipeIngredientsTable);
      await tx.delete(schema.feedRecipesTable);
      await tx.delete(schema.poultryMovementsTable);
      await tx.delete(schema.poultryLotsTable);
      await tx.delete(schema.movementsTable);
      await tx.delete(schema.financeEntriesTable);
      await tx.delete(schema.productsTable);
    }

    const insertedProducts = await tx
      .insert(schema.productsTable)
      .values([
        {
          name: "Milho em Grão",
          category: "feed",
          unit: "kg",
          quantity: 420,
          minimumQuantity: 150,
          unitCostCents: 145,
        },
        {
          name: "Farelo de Soja",
          category: "feed",
          unit: "kg",
          quantity: 160,
          minimumQuantity: 80,
          unitCostCents: 290,
        },
        {
          name: "Calcário Calcítico",
          category: "feed",
          unit: "kg",
          quantity: 45,
          minimumQuantity: 20,
          unitCostCents: 85,
        },
        {
          name: "Núcleo Postura 4%",
          category: "feed",
          unit: "kg",
          quantity: 12,
          minimumQuantity: 20,
          unitCostCents: 680,
        },
        {
          name: "Ração Inicial Pintinhos",
          category: "feed",
          unit: "kg",
          quantity: 18,
          minimumQuantity: 25,
          unitCostCents: 340,
        },
        {
          name: "Vacina Newcastle + Bronquite",
          category: "medicine",
          unit: "un",
          quantity: 3,
          minimumQuantity: 2,
          unitCostCents: 4500,
        },
        {
          name: "Cartelas para 30 Ovos",
          category: "supplies",
          unit: "un",
          quantity: 85,
          minimumQuantity: 50,
          unitCostCents: 95,
        },
      ])
      .returning();

    const [milho, soja, calcario, nucleo, , , cartela] = insertedProducts;

    await tx.insert(schema.movementsTable).values([
      {
        productId: milho.id,
        direction: "in",
        quantity: 450,
        note: "Compra de 9 sacas na Cooperativa",
      },
      {
        productId: soja.id,
        direction: "in",
        quantity: 180,
        note: "Compra de farelo de soja",
      },
      {
        productId: nucleo.id,
        direction: "in",
        quantity: 20,
        note: "Compra na Casa do Criador",
      },
      {
        productId: cartela.id,
        direction: "out",
        quantity: 15,
        note: "Entrega de ovos na feira de sábado",
      },
    ]);

    const insertedLots = await tx
      .insert(schema.poultryLotsTable)
      .values([
        {
          label: "Galpão 1 — Poedeiras Caipiras",
          kind: "layers",
          receivedAt: isoDateOffset(-45),
          source: "Aviário São Pedro",
          breed: "Isa Brown",
          ageWeeks: 24,
          initialCount: 250,
          currentCount: 246,
        },
        {
          label: "Galpão 2 — Frangos de Corte",
          kind: "broilers",
          receivedAt: isoDateOffset(-30),
          source: "Incubatório Vale Verde",
          breed: "Caipirão Pesado",
          ageWeeks: 8,
          initialCount: 150,
          currentCount: 135,
        },
        {
          label: "Pinteiro — Reposição Postura",
          kind: "chicks",
          receivedAt: isoDateOffset(-10),
          source: "Aviário São Pedro",
          breed: "Embrapa 051",
          ageWeeks: 2,
          initialCount: 80,
          currentCount: 80,
        },
      ])
      .returning();

    const [lotePoedeiras, loteFrangos, lotePintinhos] = insertedLots;

    await tx.insert(schema.poultryMovementsTable).values([
      {
        lotId: lotePoedeiras.id,
        direction: "in",
        quantity: 250,
        movementDate: isoDateOffset(-45),
        counterparty: "Aviário São Pedro",
        reason: null,
      },
      {
        lotId: lotePoedeiras.id,
        direction: "out",
        quantity: 4,
        movementDate: isoDateOffset(-12),
        counterparty: "Adaptação inicial",
        reason: "mortality",
      },
      {
        lotId: loteFrangos.id,
        direction: "in",
        quantity: 150,
        movementDate: isoDateOffset(-30),
        counterparty: "Incubatório Vale Verde",
        reason: null,
      },
      {
        lotId: loteFrangos.id,
        direction: "out",
        quantity: 15,
        movementDate: isoDateOffset(-3),
        counterparty: "Restaurante Sabor da Roça",
        reason: "sale",
      },
      {
        lotId: lotePintinhos.id,
        direction: "in",
        quantity: 80,
        movementDate: isoDateOffset(-10),
        counterparty: "Aviário São Pedro",
        reason: null,
      },
    ]);

    const [receitaPostura, receitaEngorda] = await tx
      .insert(schema.feedRecipesTable)
      .values([
        { name: "Mistura Postura Casa (100 kg)" },
        { name: "Mistura Engorda Caipira (100 kg)" },
      ])
      .returning();

    await tx.insert(schema.feedRecipeIngredientsTable).values([
      { recipeId: receitaPostura.id, productId: milho.id, quantityKg: 62 },
      { recipeId: receitaPostura.id, productId: soja.id, quantityKg: 24 },
      { recipeId: receitaPostura.id, productId: calcario.id, quantityKg: 10 },
      { recipeId: receitaPostura.id, productId: nucleo.id, quantityKg: 4 },
      { recipeId: receitaEngorda.id, productId: milho.id, quantityKg: 70 },
      { recipeId: receitaEngorda.id, productId: soja.id, quantityKg: 26 },
      { recipeId: receitaEngorda.id, productId: nucleo.id, quantityKg: 4 },
    ]);

    await tx.insert(schema.feedingLogsTable).values([
      {
        lotId: lotePoedeiras.id,
        recipeId: receitaPostura.id,
        lotLabelSnapshot: lotePoedeiras.label,
        recipeNameSnapshot: receitaPostura.name,
        quantityKg: 28,
        totalCostCents: 5466,
        feedingDate: isoDateOffset(0),
      },
      {
        lotId: loteFrangos.id,
        recipeId: receitaEngorda.id,
        lotLabelSnapshot: loteFrangos.label,
        recipeNameSnapshot: receitaEngorda.name,
        quantityKg: 22,
        totalCostCents: 4490,
        feedingDate: isoDateOffset(-1),
      },
    ]);

    await tx.insert(schema.financeEntriesTable).values([
      {
        kind: "receivable",
        description: "Venda de 45 dúzias de ovos — Mercearia São José",
        amountCents: 54000,
        dueDate: isoDateOffset(2),
        status: "pending",
        category: "Venda de ovos",
      },
      {
        kind: "receivable",
        description: "Encomenda de 15 frangos caipiras — Restaurante Sabor da Roça",
        amountCents: 67500,
        dueDate: isoDateOffset(5),
        status: "pending",
        category: "Outros",
      },
      {
        kind: "payable",
        description: "Reposição de Milho e Núcleo — Cooperativa Agrícola",
        amountCents: 48500,
        dueDate: isoDateOffset(3),
        status: "pending",
        category: "Ração e alimentação",
      },
      {
        kind: "payable",
        description: "Conta de Energia Elétrica dos Galpões",
        amountCents: 21890,
        dueDate: isoDateOffset(7),
        status: "pending",
        category: "Insumos",
      },
      {
        kind: "receivable",
        description: "Feira Livre de Sábado — Ovos Caipiras",
        amountCents: 38000,
        dueDate: isoDateOffset(-2),
        status: "settled",
        category: "Venda de ovos",
        settledAt: new Date(),
      },
    ]);
  });

  return true;
}

let dbReadyPromise: Promise<boolean> | null = null;
let lastDbError: string | null = null;

export function getLastDatabaseError(): string | null {
  return lastDbError;
}

export async function ensureDatabaseReady(): Promise<boolean> {
  if (!pool) {
    return false;
  }
  if (dbReadyPromise) {
    return dbReadyPromise;
  }

  dbReadyPromise = (async () => {
    try {
      await pool.query(INIT_SCHEMA_SQL);
      if (process.env.AUTO_SEED_MVP !== "false") {
        await seedMvpDatabase(false);
      }
      lastDbError = null;
      return true;
    } catch (err) {
      lastDbError = err instanceof Error ? err.message : String(err);
      dbReadyPromise = null;
      return false;
    }
  })();

  return dbReadyPromise;
}

export * from "./schema";
