import {
  asc,
  desc,
  eq,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  feedRecipeIngredientsTable,
  financeEntriesTable,
  movementsTable,
  productsTable,
  type FinanceEntry,
  type Product,
} from "@workspace/db";
import {
  CreateFinanceEntryBody,
  CreateFinanceEntryResponse,
  CreateMovementBody,
  CreateMovementResponse,
  CreateProductBody,
  CreateProductResponse,
  DeleteFinanceEntryParams,
  DeleteFinanceEntryResponse,
  DeleteMovementParams,
  DeleteMovementResponse,
  DeleteProductParams,
  DeleteProductResponse,
  GetDashboardResponse,
  GetFinanceEntriesResponse,
  GetMovementsResponse,
  GetProductsResponse,
  UpdateFinanceEntryBody,
  UpdateFinanceEntryParams,
  UpdateFinanceEntryResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function presentProduct(product: Product) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    unit: product.unit,
    quantity: product.quantity,
    minimumQuantity: product.minimumQuantity,
    unitCost:
      product.unitCostCents === null ? null : product.unitCostCents / 100,
    createdAt: product.createdAt.toISOString(),
  };
}

function presentFinanceEntry(entry: FinanceEntry) {
  return {
    id: entry.id,
    kind: entry.kind,
    description: entry.description,
    amount: entry.amountCents / 100,
    dueDate: entry.dueDate,
    status: entry.status,
    category: entry.category,
    createdAt: entry.createdAt.toISOString(),
    settledAt: entry.settledAt?.toISOString() ?? null,
  };
}

function dateForDatabase(value: Date): string {
  return value.toISOString().slice(0, 10);
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  const products = await db
    .select()
    .from(productsTable)
    .orderBy(asc(productsTable.name));
  const pendingEntries = await db
    .select()
    .from(financeEntriesTable)
    .where(eq(financeEntriesTable.status, "pending"));
  const recentEntries = await db
    .select()
    .from(financeEntriesTable)
    .orderBy(desc(financeEntriesTable.createdAt))
    .limit(5);
  const lowStockProducts = products.filter(
    (product) =>
      product.minimumQuantity !== null &&
      product.quantity <= product.minimumQuantity,
  );

  res.json(
    GetDashboardResponse.parse({
      productCount: products.length,
      lowStockCount: lowStockProducts.length,
      pendingPayables:
        pendingEntries
          .filter((entry) => entry.kind === "payable")
          .reduce((sum, entry) => sum + entry.amountCents, 0) / 100,
      pendingReceivables:
        pendingEntries
          .filter((entry) => entry.kind === "receivable")
          .reduce((sum, entry) => sum + entry.amountCents, 0) / 100,
      recentFinanceEntries: recentEntries.map(presentFinanceEntry),
      lowStockProducts: lowStockProducts.map(presentProduct),
    }),
  );
});

router.get("/inventory/products", async (_req, res): Promise<void> => {
  const products = await db
    .select()
    .from(productsTable)
    .orderBy(asc(productsTable.name));
  res.json(GetProductsResponse.parse(products.map(presentProduct)));
});

router.post("/inventory/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await db
    .insert(productsTable)
    .values({
      name: parsed.data.name.trim(),
      category: parsed.data.category,
      unit: parsed.data.unit.trim(),
      quantity: parsed.data.quantity,
      minimumQuantity: parsed.data.minimumQuantity ?? null,
      unitCostCents:
        parsed.data.unitCost == null
          ? null
          : Math.round(parsed.data.unitCost * 100),
    })
    .returning();
  res.status(201).json(CreateProductResponse.parse(presentProduct(product)));
});

router.patch(
  "/inventory/products/:productId",
  async (req, res): Promise<void> => {
    const params = UpdateProductParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = UpdateProductBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    if (body.data.category !== undefined || body.data.unit !== undefined) {
      const [usedInRecipe] = await db
        .select({ id: feedRecipeIngredientsTable.id })
        .from(feedRecipeIngredientsTable)
        .where(eq(feedRecipeIngredientsTable.productId, params.data.productId))
        .limit(1);
      if (
        usedInRecipe &&
        (body.data.category !== undefined && body.data.category !== "feed" ||
          body.data.unit !== undefined &&
            body.data.unit.toLowerCase() !== "kg")
      ) {
        res.status(409).json({
          error:
            "Este ingrediente está em uma receita de ração e precisa continuar como Alimentação, em quilos.",
        });
        return;
      }
    }
    const changes: Partial<typeof productsTable.$inferInsert> = {};
    if (body.data.name !== undefined) changes.name = body.data.name.trim();
    if (body.data.category !== undefined) changes.category = body.data.category;
    if (body.data.unit !== undefined) changes.unit = body.data.unit.trim();
    if (body.data.minimumQuantity !== undefined) {
      changes.minimumQuantity = body.data.minimumQuantity ?? null;
    }
    if (body.data.unitCost !== undefined) {
      changes.unitCostCents =
        body.data.unitCost === null
          ? null
          : Math.round(body.data.unitCost * 100);
    }
    const [product] = await db
      .update(productsTable)
      .set(changes)
      .where(eq(productsTable.id, params.data.productId))
      .returning();
    if (!product) {
      res.status(404).json({ error: "Produto não encontrado." });
      return;
    }
    res.json(UpdateProductResponse.parse(presentProduct(product)));
  },
);

router.delete(
  "/inventory/products/:productId",
  async (req, res): Promise<void> => {
    const params = DeleteProductParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [movement] = await db
      .select({ id: movementsTable.id })
      .from(movementsTable)
      .where(eq(movementsTable.productId, params.data.productId))
      .limit(1);
    if (movement) {
      res.status(409).json({
        error:
          "Este item tem histórico de estoque e não pode ser apagado. Edite o nome ou mantenha o cadastro.",
      });
      return;
    }
    const [recipeIngredient] = await db
      .select({ id: feedRecipeIngredientsTable.id })
      .from(feedRecipeIngredientsTable)
      .where(eq(feedRecipeIngredientsTable.productId, params.data.productId))
      .limit(1);
    if (recipeIngredient) {
      res.status(409).json({
        error:
          "Este item faz parte de uma receita de ração. Remova-o da receita antes de excluir o cadastro.",
      });
      return;
    }
    const [product] = await db
      .delete(productsTable)
      .where(eq(productsTable.id, params.data.productId))
      .returning();
    if (!product) {
      res.status(404).json({ error: "Produto não encontrado." });
      return;
    }
    res.status(204).json(DeleteProductResponse.parse(undefined));
  },
);

router.get("/inventory/movements", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: movementsTable.id,
      productId: movementsTable.productId,
      productName: productsTable.name,
      direction: movementsTable.direction,
      quantity: movementsTable.quantity,
      note: movementsTable.note,
      createdAt: movementsTable.createdAt,
    })
    .from(movementsTable)
    .innerJoin(productsTable, eq(movementsTable.productId, productsTable.id))
    .orderBy(desc(movementsTable.createdAt));
  res.json(
    GetMovementsResponse.parse(
      rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    ),
  );
});

router.post("/inventory/movements", async (req, res): Promise<void> => {
  const parsed = CreateMovementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [product] = await tx
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, parsed.data.productId))
      .for("update");
    if (!product) return { error: "not_found" as const };

    if (
      parsed.data.direction === "out" &&
      product.quantity < parsed.data.quantity
    ) {
      return { error: "insufficient_stock" as const };
    }

    const nextQuantity =
      parsed.data.direction === "in"
        ? product.quantity + parsed.data.quantity
        : product.quantity - parsed.data.quantity;
    await tx
      .update(productsTable)
      .set({ quantity: nextQuantity })
      .where(eq(productsTable.id, product.id));

    const [movement] = await tx
      .insert(movementsTable)
      .values({
        productId: product.id,
        direction: parsed.data.direction,
        quantity: parsed.data.quantity,
        note: parsed.data.note ?? null,
      })
      .returning();

    return {
      movement: {
        ...movement,
        productName: product.name,
        createdAt: movement.createdAt.toISOString(),
      },
    };
  });

  if ("error" in result) {
    if (result.error === "not_found") {
      res.status(404).json({ error: "Produto não encontrado." });
      return;
    }
    res.status(400).json({ error: "Não há estoque suficiente para essa saída." });
    return;
  }

  res.status(201).json(CreateMovementResponse.parse(result.movement));
});

router.delete(
  "/inventory/movements/:movementId",
  async (req, res): Promise<void> => {
    const params = DeleteMovementParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [movement] = await tx
        .select()
        .from(movementsTable)
        .where(eq(movementsTable.id, params.data.movementId))
        .for("update");
      if (!movement) return { error: "not_found" as const };
      if (movement.sourceType === "feeding") {
        return { error: "feeding_log" as const };
      }

      const [product] = await tx
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, movement.productId))
        .for("update");
      if (!product) return { error: "not_found" as const };

      const nextQuantity =
        movement.direction === "in"
          ? product.quantity - movement.quantity
          : product.quantity + movement.quantity;
      if (nextQuantity < 0) return { error: "negative_stock" as const };

      await tx
        .update(productsTable)
        .set({ quantity: nextQuantity })
        .where(eq(productsTable.id, product.id));
      await tx
        .delete(movementsTable)
        .where(eq(movementsTable.id, movement.id));
      return { deleted: true as const };
    });

    if ("error" in result) {
      if (result.error === "not_found") {
        res.status(404).json({ error: "Movimentação não encontrada." });
        return;
      }
      if (result.error === "feeding_log") {
        res.status(400).json({
          error:
            "Este movimento pertence a um registro de alimentação. Exclua o registro pela página de alimentação para restaurar o estoque.",
        });
        return;
      }
      res.status(400).json({
        error:
          "Não é possível desfazer esta entrada porque o estoque atual ficaria negativo.",
      });
      return;
    }
    res.status(204).json(DeleteMovementResponse.parse(undefined));
  },
);

router.get("/finance/entries", async (_req, res): Promise<void> => {
  const entries = await db
    .select()
    .from(financeEntriesTable)
    .orderBy(asc(financeEntriesTable.dueDate), desc(financeEntriesTable.createdAt));
  res.json(
    GetFinanceEntriesResponse.parse(entries.map(presentFinanceEntry)),
  );
});

router.post("/finance/entries", async (req, res): Promise<void> => {
  const parsed = CreateFinanceEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [entry] = await db
    .insert(financeEntriesTable)
    .values({
      kind: parsed.data.kind,
      description: parsed.data.description.trim(),
      amountCents: Math.round(parsed.data.amount * 100),
      dueDate: dateForDatabase(parsed.data.dueDate),
      category: parsed.data.category?.trim() || null,
    })
    .returning();
  res
    .status(201)
    .json(CreateFinanceEntryResponse.parse(presentFinanceEntry(entry)));
});

router.patch(
  "/finance/entries/:entryId",
  async (req, res): Promise<void> => {
    const params = UpdateFinanceEntryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = UpdateFinanceEntryBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const changes: Partial<typeof financeEntriesTable.$inferInsert> = {};
    if (body.data.description !== undefined) {
      changes.description = body.data.description.trim();
    }
    if (body.data.amount !== undefined) {
      changes.amountCents = Math.round(body.data.amount * 100);
    }
    if (body.data.dueDate !== undefined) {
      changes.dueDate = dateForDatabase(body.data.dueDate);
    }
    if (body.data.category !== undefined) {
      changes.category = body.data.category.trim() || null;
    }
    if (body.data.status !== undefined) {
      changes.status = body.data.status;
      changes.settledAt =
        body.data.status === "settled" ? new Date() : null;
    }

    const [entry] = await db
      .update(financeEntriesTable)
      .set(changes)
      .where(eq(financeEntriesTable.id, params.data.entryId))
      .returning();
    if (!entry) {
      res.status(404).json({ error: "Conta não encontrada." });
      return;
    }
    res.json(UpdateFinanceEntryResponse.parse(presentFinanceEntry(entry)));
  },
);

router.delete(
  "/finance/entries/:entryId",
  async (req, res): Promise<void> => {
    const params = DeleteFinanceEntryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [entry] = await db
      .delete(financeEntriesTable)
      .where(eq(financeEntriesTable.id, params.data.entryId))
      .returning();
    if (!entry) {
      res.status(404).json({ error: "Conta não encontrada." });
      return;
    }
    res.status(204).json(DeleteFinanceEntryResponse.parse(undefined));
  },
);

export default router;