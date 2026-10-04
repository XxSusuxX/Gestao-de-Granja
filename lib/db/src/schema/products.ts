import {
  doublePrecision,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productCategoryEnum = pgEnum("product_category", [
  "feed",
  "medicine",
  "supplies",
  "equipment",
  "other",
]);

export const productsTable = pgTable("farm_products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: productCategoryEnum("category").notNull(),
  unit: text("unit").notNull(),
  quantity: doublePrecision("quantity").notNull().default(0),
  minimumQuantity: doublePrecision("minimum_quantity"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;