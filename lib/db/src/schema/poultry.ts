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

export const poultryLotKindEnum = pgEnum("poultry_lot_kind", [
  "layers",
  "broilers",
  "chicks",
  "other",
]);

export const poultryMovementDirectionEnum = pgEnum(
  "poultry_movement_direction",
  ["in", "out"],
);

export const poultryExitReasonEnum = pgEnum("poultry_exit_reason", [
  "sale",
  "transfer",
  "mortality",
  "other",
]);

export const poultryLotsTable = pgTable("farm_poultry_lots", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  kind: poultryLotKindEnum("kind").notNull(),
  receivedAt: date("received_at", { mode: "string" }).notNull(),
  source: text("source"),
  breed: text("breed"),
  ageWeeks: integer("age_weeks"),
  initialCount: integer("initial_count").notNull(),
  currentCount: integer("current_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const poultryMovementsTable = pgTable("farm_poultry_movements", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id")
    .notNull()
    .references(() => poultryLotsTable.id, { onDelete: "restrict" }),
  direction: poultryMovementDirectionEnum("direction").notNull(),
  quantity: integer("quantity").notNull(),
  movementDate: date("movement_date", { mode: "string" }).notNull(),
  counterparty: text("counterparty"),
  reason: poultryExitReasonEnum("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPoultryLotSchema = createInsertSchema(poultryLotsTable).omit({
  id: true,
  currentCount: true,
  createdAt: true,
});
export type InsertPoultryLot = z.infer<typeof insertPoultryLotSchema>;
export type PoultryLot = typeof poultryLotsTable.$inferSelect;
export type PoultryMovement = typeof poultryMovementsTable.$inferSelect;