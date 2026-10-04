import {
  date,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const financeKindEnum = pgEnum("finance_kind", [
  "payable",
  "receivable",
]);
export const financeStatusEnum = pgEnum("finance_status", [
  "pending",
  "settled",
]);

export const financeEntriesTable = pgTable("farm_finance_entries", {
  id: serial("id").primaryKey(),
  kind: financeKindEnum("kind").notNull(),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  status: financeStatusEnum("status").notNull().default("pending"),
  category: text("category"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
});

export const insertFinanceEntrySchema = createInsertSchema(
  financeEntriesTable,
).omit({
  id: true,
  createdAt: true,
  settledAt: true,
});
export type InsertFinanceEntry = z.infer<typeof insertFinanceEntrySchema>;
export type FinanceEntry = typeof financeEntriesTable.$inferSelect;