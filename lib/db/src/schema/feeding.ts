import {
  date,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { poultryLotsTable } from "./poultry";
import { productsTable } from "./products";

export const feedRecipesTable = pgTable("farm_feed_recipes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const feedRecipeIngredientsTable = pgTable(
  "farm_feed_recipe_ingredients",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => feedRecipesTable.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "restrict" }),
    quantityKg: doublePrecision("quantity_kg").notNull(),
  },
);

export const feedingLogsTable = pgTable("farm_feeding_logs", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id")
    .notNull()
    .references(() => poultryLotsTable.id, { onDelete: "restrict" }),
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => feedRecipesTable.id, { onDelete: "restrict" }),
  lotLabelSnapshot: text("lot_label_snapshot").notNull(),
  recipeNameSnapshot: text("recipe_name_snapshot").notNull(),
  quantityKg: doublePrecision("quantity_kg").notNull(),
  totalCostCents: integer("total_cost_cents"),
  feedingDate: date("feeding_date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertFeedRecipeSchema = createInsertSchema(feedRecipesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertFeedRecipe = z.infer<typeof insertFeedRecipeSchema>;
export type FeedRecipe = typeof feedRecipesTable.$inferSelect;
export type FeedRecipeIngredient =
  typeof feedRecipeIngredientsTable.$inferSelect;
export type FeedingLog = typeof feedingLogsTable.$inferSelect;