import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  feedRecipeIngredientsTable,
  feedRecipesTable,
  feedingLogsTable,
  movementsTable,
  poultryLotsTable,
  productsTable,
} from "@workspace/db";
import {
  CreateFeedLogBody,
  CreateFeedLogResponse,
  CreateFeedRecipeBody,
  CreateFeedRecipeResponse,
  DeleteFeedLogParams,
  DeleteFeedLogResponse,
  DeleteFeedRecipeParams,
  DeleteFeedRecipeResponse,
  GetFeedLogsResponse,
  GetFeedRecipesResponse,
  GetFeedingSummaryResponse,
  UpdateFeedRecipeBody,
  UpdateFeedRecipeParams,
  UpdateFeedRecipeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const roundKg = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const dateForDatabase = (value: Date) => value.toISOString().slice(0, 10);

function presentFeedLog(log: typeof feedingLogsTable.$inferSelect) {
  return {
    id: log.id,
    lotId: log.lotId,
    lotLabel: log.lotLabelSnapshot,
    recipeId: log.recipeId,
    recipeName: log.recipeNameSnapshot,
    quantityKg: log.quantityKg,
    totalCost:
      log.totalCostCents === null ? null : log.totalCostCents / 100,
    feedingDate: log.feedingDate,
    createdAt: log.createdAt.toISOString(),
  };
}

async function loadRecipes() {
  const recipes = await db
    .select()
    .from(feedRecipesTable)
    .orderBy(asc(feedRecipesTable.name));
  const ingredients = await db
    .select({
      recipeId: feedRecipeIngredientsTable.recipeId,
      productId: productsTable.id,
      productName: productsTable.name,
      quantityKg: feedRecipeIngredientsTable.quantityKg,
      unitCostCents: productsTable.unitCostCents,
      availableQuantity: productsTable.quantity,
    })
    .from(feedRecipeIngredientsTable)
    .innerJoin(
      productsTable,
      eq(feedRecipeIngredientsTable.productId, productsTable.id),
    )
    .orderBy(asc(productsTable.name));

  return recipes.map((recipe) => {
    const recipeIngredients = ingredients
      .filter((ingredient) => ingredient.recipeId === recipe.id)
      .map((ingredient) => ({
        productId: ingredient.productId,
        productName: ingredient.productName,
        quantityKg: ingredient.quantityKg,
        unitCost:
          ingredient.unitCostCents === null
            ? null
            : ingredient.unitCostCents / 100,
        lineCost:
          ingredient.unitCostCents === null
            ? null
            : Math.round(ingredient.quantityKg * ingredient.unitCostCents) /
              100,
        availableQuantity: ingredient.availableQuantity,
      }));
    const batchWeightKg = recipeIngredients.reduce(
      (total, ingredient) => total + ingredient.quantityKg,
      0,
    );
    const hasAllCosts = recipeIngredients.every(
      (ingredient) => ingredient.lineCost !== null,
    );
    const costPerBatch = hasAllCosts
      ? Math.round(
          recipeIngredients.reduce(
            (total, ingredient) =>
              total + (ingredient.lineCost ?? 0) * 100,
            0,
          ),
        ) / 100
      : null;
    return {
      ...recipe,
      createdAt: recipe.createdAt.toISOString(),
      batchWeightKg,
      costPerBatch,
      costPerKg:
        costPerBatch === null || batchWeightKg <= 0
          ? null
          : Math.round((costPerBatch / batchWeightKg) * 100) / 100,
      ingredients: recipeIngredients,
    };
  });
}

function hasRepeatedProducts(
  ingredients: Array<{ productId: number; quantityKg: number }>,
) {
  return new Set(ingredients.map((ingredient) => ingredient.productId)).size !==
    ingredients.length;
}

router.get("/feeding/summary", async (_req, res): Promise<void> => {
  const logs = await db.select().from(feedingLogsTable);
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  const todayLogs = logs.filter((log) => log.feedingDate === today);
  const monthLogs = logs.filter(
    (log) => log.feedingDate >= monthStart && log.feedingDate <= today,
  );
  const sumCost = (items: typeof logs) =>
    items.some((item) => item.totalCostCents === null)
      ? null
      : items.reduce((total, item) => total + (item.totalCostCents ?? 0), 0) /
        100;
  res.json(
    GetFeedingSummaryResponse.parse({
      todayQuantityKg: todayLogs.reduce(
        (total, log) => total + log.quantityKg,
        0,
      ),
      todayCost: sumCost(todayLogs),
      monthCost: sumCost(monthLogs),
      logsToday: todayLogs.length,
    }),
  );
});

router.get("/feeding/recipes", async (_req, res): Promise<void> => {
  res.json(GetFeedRecipesResponse.parse(await loadRecipes()));
});

router.post("/feeding/recipes", async (req, res): Promise<void> => {
  const body = CreateFeedRecipeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (hasRepeatedProducts(body.data.ingredients)) {
    res.status(400).json({ error: "Cada ingrediente deve aparecer uma única vez na receita." });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const productIds = body.data.ingredients.map((item) => item.productId);
    const products = await tx
      .select()
      .from(productsTable)
      .where(inArray(productsTable.id, productIds));
    if (
      products.length !== productIds.length ||
      products.some(
        (product) =>
          product.category !== "feed" || product.unit.toLowerCase() !== "kg",
      )
    ) {
      return { error: "invalid_ingredient" as const };
    }
    const [recipe] = await tx
      .insert(feedRecipesTable)
      .values({ name: body.data.name.trim() })
      .returning();
    await tx.insert(feedRecipeIngredientsTable).values(
      body.data.ingredients.map((ingredient) => ({
        recipeId: recipe.id,
        productId: ingredient.productId,
        quantityKg: ingredient.quantityKg,
      })),
    );
    return { recipe };
  });
  if ("error" in result) {
    res.status(400).json({
      error: "Use ingredientes cadastrados como Alimentação, medidos em quilos.",
    });
    return;
  }
  const recipe = (await loadRecipes()).find(
    (item) => item.id === result.recipe.id,
  );
  res.status(201).json(CreateFeedRecipeResponse.parse(recipe));
});

router.patch(
  "/feeding/recipes/:recipeId",
  async (req, res): Promise<void> => {
    const params = UpdateFeedRecipeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = UpdateFeedRecipeBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    if (hasRepeatedProducts(body.data.ingredients)) {
      res.status(400).json({ error: "Cada ingrediente deve aparecer uma única vez na receita." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [recipe] = await tx
        .select()
        .from(feedRecipesTable)
        .where(eq(feedRecipesTable.id, params.data.recipeId))
        .for("update");
      if (!recipe) return { error: "not_found" as const };
      const productIds = body.data.ingredients.map((item) => item.productId);
      const products = await tx
        .select()
        .from(productsTable)
        .where(inArray(productsTable.id, productIds));
      if (
        products.length !== productIds.length ||
        products.some(
          (product) =>
            product.category !== "feed" || product.unit.toLowerCase() !== "kg",
        )
      ) {
        return { error: "invalid_ingredient" as const };
      }
      const [updated] = await tx
        .update(feedRecipesTable)
        .set({ name: body.data.name.trim() })
        .where(eq(feedRecipesTable.id, recipe.id))
        .returning();
      await tx
        .delete(feedRecipeIngredientsTable)
        .where(eq(feedRecipeIngredientsTable.recipeId, recipe.id));
      await tx.insert(feedRecipeIngredientsTable).values(
        body.data.ingredients.map((ingredient) => ({
          recipeId: recipe.id,
          productId: ingredient.productId,
          quantityKg: ingredient.quantityKg,
        })),
      );
      return { recipe: updated };
    });
    if ("error" in result) {
      if (result.error === "not_found") {
        res.status(404).json({ error: "Receita não encontrada." });
        return;
      }
      res.status(400).json({
        error: "Use ingredientes cadastrados como Alimentação, medidos em quilos.",
      });
      return;
    }
    const recipe = (await loadRecipes()).find(
      (item) => item.id === result.recipe.id,
    );
    res.json(UpdateFeedRecipeResponse.parse(recipe));
  },
);

router.delete(
  "/feeding/recipes/:recipeId",
  async (req, res): Promise<void> => {
    const params = DeleteFeedRecipeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [recipe] = await tx
        .select()
        .from(feedRecipesTable)
        .where(eq(feedRecipesTable.id, params.data.recipeId))
        .for("update");
      if (!recipe) return { error: "not_found" as const };
      const [used] = await tx
        .select({ id: feedingLogsTable.id })
        .from(feedingLogsTable)
        .where(eq(feedingLogsTable.recipeId, recipe.id))
        .limit(1);
      if (used) return { error: "in_use" as const };
      await tx
        .delete(feedRecipeIngredientsTable)
        .where(eq(feedRecipeIngredientsTable.recipeId, recipe.id));
      await tx
        .delete(feedRecipesTable)
        .where(eq(feedRecipesTable.id, recipe.id));
      return { deleted: true as const };
    });
    if ("error" in result) {
      if (result.error === "not_found") {
        res.status(404).json({ error: "Receita não encontrada." });
        return;
      }
      res.status(409).json({
        error:
          "Esta receita já foi usada. Mantenha o histórico e crie outra receita se necessário.",
      });
      return;
    }
    res.status(204).json(DeleteFeedRecipeResponse.parse(undefined));
  },
);

router.get("/feeding/logs", async (_req, res): Promise<void> => {
  const logs = await db
    .select()
    .from(feedingLogsTable)
    .orderBy(desc(feedingLogsTable.feedingDate), desc(feedingLogsTable.id));
  res.json(GetFeedLogsResponse.parse(logs.map(presentFeedLog)));
});

router.post("/feeding/logs", async (req, res): Promise<void> => {
  const body = CreateFeedLogBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [lot] = await tx
      .select()
      .from(poultryLotsTable)
      .where(eq(poultryLotsTable.id, body.data.lotId))
      .for("update");
    if (!lot) return { error: "lot_not_found" as const };
    if (lot.currentCount === 0) {
      return { error: "inactive_lot" as const };
    }
    const [recipe] = await tx
      .select()
      .from(feedRecipesTable)
      .where(eq(feedRecipesTable.id, body.data.recipeId))
      .for("update");
    if (!recipe) return { error: "recipe_not_found" as const };
    const ingredients = await tx
      .select()
      .from(feedRecipeIngredientsTable)
      .where(eq(feedRecipeIngredientsTable.recipeId, recipe.id))
      .orderBy(asc(feedRecipeIngredientsTable.id));
    const batchWeightKg = ingredients.reduce(
      (total, ingredient) => total + ingredient.quantityKg,
      0,
    );
    if (batchWeightKg <= 0) return { error: "invalid_recipe" as const };

    const allocations = [];
    for (const ingredient of ingredients) {
      const [product] = await tx
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, ingredient.productId))
        .for("update");
      if (!product) return { error: "invalid_recipe" as const };
      const quantityUsed = roundKg(
        (body.data.quantityKg * ingredient.quantityKg) / batchWeightKg,
      );
      if (product.quantity + 0.0000001 < quantityUsed) {
        return {
          error: "insufficient_stock" as const,
          productName: product.name,
        };
      }
      allocations.push({ product, quantityUsed });
    }

    const totalCostCents = allocations.some(
      ({ product }) => product.unitCostCents === null,
    )
      ? null
      : allocations.reduce(
          (total, { product, quantityUsed }) =>
            total +
            Math.round(quantityUsed * (product.unitCostCents ?? 0)),
          0,
        );
    const [log] = await tx
      .insert(feedingLogsTable)
      .values({
        lotId: lot.id,
        recipeId: recipe.id,
        lotLabelSnapshot: lot.label,
        recipeNameSnapshot: recipe.name,
        quantityKg: body.data.quantityKg,
        totalCostCents,
        feedingDate: dateForDatabase(body.data.feedingDate),
      })
      .returning();

    for (const { product, quantityUsed } of allocations) {
      const nextQuantity = roundKg(product.quantity - quantityUsed);
      await tx
        .update(productsTable)
        .set({ quantity: nextQuantity })
        .where(eq(productsTable.id, product.id));
      await tx.insert(movementsTable).values({
        productId: product.id,
        direction: "out",
        quantity: quantityUsed,
        note: `Alimentação · ${recipe.name} · ${lot.label}`,
        sourceType: "feeding",
        sourceId: log.id,
      });
    }
    return { log };
  });

  if ("error" in result) {
    if (result.error === "lot_not_found") {
      res.status(404).json({ error: "Lote de aves não encontrado." });
      return;
    }
    if (result.error === "recipe_not_found") {
      res.status(404).json({ error: "Receita de ração não encontrada." });
      return;
    }
    if (result.error === "insufficient_stock") {
      res.status(400).json({
        error: `Estoque insuficiente de ${result.productName} para essa alimentação.`,
      });
      return;
    }
    res.status(400).json({
      error:
        result.error === "inactive_lot"
          ? "Não é possível registrar alimentação para um lote sem aves."
          : "A receita não possui ingredientes válidos.",
    });
    return;
  }
  res
    .status(201)
    .json(CreateFeedLogResponse.parse(presentFeedLog(result.log)));
});

router.delete(
  "/feeding/logs/:logId",
  async (req, res): Promise<void> => {
    const params = DeleteFeedLogParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [log] = await tx
        .select()
        .from(feedingLogsTable)
        .where(eq(feedingLogsTable.id, params.data.logId))
        .for("update");
      if (!log) return { error: "not_found" as const };
      const movements = await tx
        .select()
        .from(movementsTable)
        .where(
          and(
            eq(movementsTable.sourceType, "feeding"),
            eq(movementsTable.sourceId, log.id),
          ),
        )
        .for("update");
      for (const movement of movements) {
        const [product] = await tx
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, movement.productId))
          .for("update");
        if (!product) return { error: "missing_product" as const };
        await tx
          .update(productsTable)
          .set({ quantity: roundKg(product.quantity + movement.quantity) })
          .where(eq(productsTable.id, product.id));
      }
      await tx
        .delete(movementsTable)
        .where(
          and(
            eq(movementsTable.sourceType, "feeding"),
            eq(movementsTable.sourceId, log.id),
          ),
        );
      await tx
        .delete(feedingLogsTable)
        .where(eq(feedingLogsTable.id, log.id));
      return { deleted: true as const };
    });
    if ("error" in result) {
      if (result.error === "not_found") {
        res.status(404).json({ error: "Registro de alimentação não encontrado." });
        return;
      }
      res.status(400).json({
        error: "Não foi possível restaurar os ingredientes deste registro.",
      });
      return;
    }
    res.status(204).json(DeleteFeedLogResponse.parse(undefined));
  },
);

export default router;