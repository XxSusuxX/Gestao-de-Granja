import {
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productsTable } from "./products";

export const movementDirectionEnum = pgEnum("movement_direction", [
  "in",
  "out",
]);

export const movementsTable = pgTable("farm_stock_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "restrict" }),
  direction: movementDirectionEnum("direction").notNull(),
  quantity: doublePrecision("quantity").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMovementSchema = createInsertSchema(movementsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMovement = z.infer<typeof insertMovementSchema>;
export type Movement = typeof movementsTable.$inferSelect;