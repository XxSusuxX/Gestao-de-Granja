import { Router, type IRouter } from "express";
import {
  CreateFeedLogBody,
  CreateFeedLogResponse,
  CreateFeedRecipeBody,
  CreateFeedRecipeResponse,
  CreateFinanceEntryBody,
  CreateFinanceEntryResponse,
  CreateMovementBody,
  CreateMovementResponse,
  CreatePoultryDispatchBody,
  CreatePoultryDispatchParams,
  CreatePoultryDispatchResponse,
  CreatePoultryLotBody,
  CreatePoultryLotResponse,
  CreateProductBody,
  CreateProductResponse,
  DeleteFeedLogParams,
  DeleteFeedLogResponse,
  DeleteFeedRecipeParams,
  DeleteFeedRecipeResponse,
  DeleteFinanceEntryParams,
  DeleteFinanceEntryResponse,
  DeleteMovementParams,
  DeleteMovementResponse,
  DeletePoultryMovementParams,
  DeletePoultryMovementResponse,
  DeleteProductParams,
  DeleteProductResponse,
  GetDashboardResponse,
  GetFeedLogsResponse,
  GetFeedRecipesResponse,
  GetFeedingSummaryResponse,
  GetFinanceEntriesResponse,
  GetMovementsResponse,
  GetPoultryLotsResponse,
  GetPoultryMovementsResponse,
  GetPoultrySummaryResponse,
  GetProductsResponse,
  UpdateFeedRecipeBody,
  UpdateFeedRecipeParams,
  UpdateFeedRecipeResponse,
  UpdateFinanceEntryBody,
  UpdateFinanceEntryParams,
  UpdateFinanceEntryResponse,
  UpdatePoultryLotBody,
  UpdatePoultryLotParams,
  UpdatePoultryLotResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";

type DemoProduct = {
  id: number;
  name: string;
  category: "feed" | "medicine" | "supplies" | "equipment" | "other";
  unit: string;
  quantity: number;
  minimumQuantity: number | null;
  unitCostCents: number | null;
  createdAt: string;
};

type DemoMovement = {
  id: number;
  productId: number;
  direction: "in" | "out";
  quantity: number;
  note: string | null;
  sourceType: string | null;
  sourceId: number | null;
  createdAt: string;
};

type DemoFinanceEntry = {
  id: number;
  kind: "payable" | "receivable";
  description: string;
  amountCents: number;
  dueDate: string;
  status: "pending" | "settled";
  category: string | null;
  createdAt: string;
  settledAt: string | null;
};

type DemoPoultryLot = {
  id: number;
  label: string;
  kind: "layers" | "broilers" | "chicks" | "other";
  receivedAt: string;
  source: string | null;
  breed: string | null;
  ageWeeks: number | null;
  initialCount: number;
  currentCount: number;
  createdAt: string;
};

type DemoPoultryMovement = {
  id: number;
  lotId: number;
  direction: "in" | "out";
  quantity: number;
  movementDate: string;
  counterparty: string | null;
  reason: "sale" | "transfer" | "mortality" | "other" | null;
  createdAt: string;
};

type DemoFeedRecipe = {
  id: number;
  name: string;
  createdAt: string;
  ingredients: Array<{ productId: number; quantityKg: number }>;
};

type DemoFeedLog = {
  id: number;
  lotId: number;
  recipeId: number;
  lotLabelSnapshot: string;
  recipeNameSnapshot: string;
  quantityKg: number;
  totalCostCents: number | null;
  feedingDate: string;
  createdAt: string;
};

function isoDateOffset(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

const roundKg = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const dateForDatabase = (value: Date) => value.toISOString().slice(0, 10);

let nextId = 100;
const allocId = () => ++nextId;

let productsStore: DemoProduct[] = [];
let movementsStore: DemoMovement[] = [];
let financeStore: DemoFinanceEntry[] = [];
let poultryLotsStore: DemoPoultryLot[] = [];
let poultryMovementsStore: DemoPoultryMovement[] = [];
let recipesStore: DemoFeedRecipe[] = [];
let feedingLogsStore: DemoFeedLog[] = [];

export function resetDemoStore(): void {
  const nowIso = new Date().toISOString();
  nextId = 100;

  productsStore = [
    {
      id: 1,
      name: "Milho em Grão",
      category: "feed",
      unit: "kg",
      quantity: 420,
      minimumQuantity: 150,
      unitCostCents: 145,
      createdAt: nowIso,
    },
    {
      id: 2,
      name: "Farelo de Soja",
      category: "feed",
      unit: "kg",
      quantity: 160,
      minimumQuantity: 80,
      unitCostCents: 290,
      createdAt: nowIso,
    },
    {
      id: 3,
      name: "Calcário Calcítico",
      category: "feed",
      unit: "kg",
      quantity: 45,
      minimumQuantity: 20,
      unitCostCents: 85,
      createdAt: nowIso,
    },
    {
      id: 4,
      name: "Núcleo Postura 4%",
      category: "feed",
      unit: "kg",
      quantity: 12,
      minimumQuantity: 20,
      unitCostCents: 680,
      createdAt: nowIso,
    },
    {
      id: 5,
      name: "Ração Inicial Pintinhos",
      category: "feed",
      unit: "kg",
      quantity: 18,
      minimumQuantity: 25,
      unitCostCents: 340,
      createdAt: nowIso,
    },
    {
      id: 6,
      name: "Vacina Newcastle + Bronquite",
      category: "medicine",
      unit: "un",
      quantity: 3,
      minimumQuantity: 2,
      unitCostCents: 4500,
      createdAt: nowIso,
    },
    {
      id: 7,
      name: "Cartelas para 30 Ovos",
      category: "supplies",
      unit: "un",
      quantity: 85,
      minimumQuantity: 50,
      unitCostCents: 95,
      createdAt: nowIso,
    },
  ];

  movementsStore = [
    {
      id: 1,
      productId: 1,
      direction: "in",
      quantity: 450,
      note: "Compra de 9 sacas na Cooperativa",
      sourceType: null,
      sourceId: null,
      createdAt: nowIso,
    },
    {
      id: 2,
      productId: 2,
      direction: "in",
      quantity: 180,
      note: "Compra de farelo de soja",
      sourceType: null,
      sourceId: null,
      createdAt: nowIso,
    },
    {
      id: 3,
      productId: 4,
      direction: "in",
      quantity: 20,
      note: "Compra na Casa do Criador",
      sourceType: null,
      sourceId: null,
      createdAt: nowIso,
    },
    {
      id: 4,
      productId: 7,
      direction: "out",
      quantity: 15,
      note: "Entrega de ovos na feira de sábado",
      sourceType: null,
      sourceId: null,
      createdAt: nowIso,
    },
  ];

  poultryLotsStore = [
    {
      id: 1,
      label: "Galpão 1 — Poedeiras Caipiras",
      kind: "layers",
      receivedAt: isoDateOffset(-45),
      source: "Aviário São Pedro",
      breed: "Isa Brown",
      ageWeeks: 24,
      initialCount: 250,
      currentCount: 246,
      createdAt: nowIso,
    },
    {
      id: 2,
      label: "Galpão 2 — Frangos de Corte",
      kind: "broilers",
      receivedAt: isoDateOffset(-30),
      source: "Incubatório Vale Verde",
      breed: "Caipirão Pesado",
      ageWeeks: 8,
      initialCount: 150,
      currentCount: 135,
      createdAt: nowIso,
    },
    {
      id: 3,
      label: "Pinteiro — Reposição Postura",
      kind: "chicks",
      receivedAt: isoDateOffset(-10),
      source: "Aviário São Pedro",
      breed: "Embrapa 051",
      ageWeeks: 2,
      initialCount: 80,
      currentCount: 80,
      createdAt: nowIso,
    },
  ];

  poultryMovementsStore = [
    {
      id: 1,
      lotId: 1,
      direction: "in",
      quantity: 250,
      movementDate: isoDateOffset(-45),
      counterparty: "Aviário São Pedro",
      reason: null,
      createdAt: nowIso,
    },
    {
      id: 2,
      lotId: 1,
      direction: "out",
      quantity: 4,
      movementDate: isoDateOffset(-12),
      counterparty: "Adaptação inicial",
      reason: "mortality",
      createdAt: nowIso,
    },
    {
      id: 3,
      lotId: 2,
      direction: "in",
      quantity: 150,
      movementDate: isoDateOffset(-30),
      counterparty: "Incubatório Vale Verde",
      reason: null,
      createdAt: nowIso,
    },
    {
      id: 4,
      lotId: 2,
      direction: "out",
      quantity: 15,
      movementDate: isoDateOffset(-3),
      counterparty: "Restaurante Sabor da Roça",
      reason: "sale",
      createdAt: nowIso,
    },
    {
      id: 5,
      lotId: 3,
      direction: "in",
      quantity: 80,
      movementDate: isoDateOffset(-10),
      counterparty: "Aviário São Pedro",
      reason: null,
      createdAt: nowIso,
    },
  ];

  recipesStore = [
    {
      id: 1,
      name: "Mistura Postura Casa (100 kg)",
      createdAt: nowIso,
      ingredients: [
        { productId: 1, quantityKg: 62 },
        { productId: 2, quantityKg: 24 },
        { productId: 3, quantityKg: 10 },
        { productId: 4, quantityKg: 4 },
      ],
    },
    {
      id: 2,
      name: "Mistura Engorda Caipira (100 kg)",
      createdAt: nowIso,
      ingredients: [
        { productId: 1, quantityKg: 70 },
        { productId: 2, quantityKg: 26 },
        { productId: 4, quantityKg: 4 },
      ],
    },
  ];

  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  feedingLogsStore = [
    {
      id: 1,
      lotId: 1,
      recipeId: 1,
      lotLabelSnapshot: "Galpão 1 — Poedeiras Caipiras",
      recipeNameSnapshot: "Mistura Postura Casa (100 kg)",
      quantityKg: 28,
      totalCostCents: 5466,
      feedingDate: today,
      createdAt: nowIso,
    },
    {
      id: 2,
      lotId: 2,
      recipeId: 2,
      lotLabelSnapshot: "Galpão 2 — Frangos de Corte",
      recipeNameSnapshot: "Mistura Engorda Caipira (100 kg)",
      quantityKg: 22,
      totalCostCents: 4490,
      feedingDate: isoDateOffset(-1),
      createdAt: nowIso,
    },
  ];

  financeStore = [
    {
      id: 1,
      kind: "receivable",
      description: "Venda de 45 dúzias de ovos — Mercearia São José",
      amountCents: 54000,
      dueDate: isoDateOffset(2),
      status: "pending",
      category: "Venda de ovos",
      createdAt: nowIso,
      settledAt: null,
    },
    {
      id: 2,
      kind: "receivable",
      description:
        "Encomenda de 15 frangos caipiras — Restaurante Sabor da Roça",
      amountCents: 67500,
      dueDate: isoDateOffset(5),
      status: "pending",
      category: "Outros",
      createdAt: nowIso,
      settledAt: null,
    },
    {
      id: 3,
      kind: "payable",
      description: "Reposição de Milho e Núcleo — Cooperativa Agrícola",
      amountCents: 48500,
      dueDate: isoDateOffset(3),
      status: "pending",
      category: "Ração e alimentação",
      createdAt: nowIso,
      settledAt: null,
    },
    {
      id: 4,
      kind: "payable",
      description: "Conta de Energia Elétrica dos Galpões",
      amountCents: 21890,
      dueDate: isoDateOffset(7),
      status: "pending",
      category: "Insumos",
      createdAt: nowIso,
      settledAt: null,
    },
    {
      id: 5,
      kind: "receivable",
      description: "Feira Livre de Sábado — Ovos Caipiras",
      amountCents: 38000,
      dueDate: isoDateOffset(-2),
      status: "settled",
      category: "Venda de ovos",
      createdAt: nowIso,
      settledAt: nowIso,
    },
  ];
}

resetDemoStore();

function presentProduct(p: DemoProduct) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    unit: p.unit,
    quantity: p.quantity,
    minimumQuantity: p.minimumQuantity,
    unitCost: p.unitCostCents === null ? null : p.unitCostCents / 100,
    createdAt: p.createdAt,
  };
}

function presentFinance(e: DemoFinanceEntry) {
  return {
    id: e.id,
    kind: e.kind,
    description: e.description,
    amount: e.amountCents / 100,
    dueDate: e.dueDate,
    status: e.status,
    category: e.category,
    createdAt: e.createdAt,
    settledAt: e.settledAt,
  };
}

function presentRecipes() {
  return recipesStore
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((recipe) => {
      const recipeIngredients = recipe.ingredients
        .map((ing) => {
          const product = productsStore.find((p) => p.id === ing.productId);
          const unitCostCents = product?.unitCostCents ?? null;
          return {
            productId: ing.productId,
            productName: product?.name ?? `Produto #${ing.productId}`,
            quantityKg: ing.quantityKg,
            unitCost: unitCostCents === null ? null : unitCostCents / 100,
            lineCost:
              unitCostCents === null
                ? null
                : Math.round(ing.quantityKg * unitCostCents) / 100,
            availableQuantity: product?.quantity ?? 0,
          };
        })
        .sort((a, b) => a.productName.localeCompare(b.productName));

      const batchWeightKg = recipeIngredients.reduce(
        (sum, i) => sum + i.quantityKg,
        0,
      );
      const hasAllCosts = recipeIngredients.every((i) => i.lineCost !== null);
      const costPerBatch = hasAllCosts
        ? Math.round(
            recipeIngredients.reduce(
              (sum, i) => sum + (i.lineCost ?? 0) * 100,
              0,
            ),
          ) / 100
        : null;

      return {
        id: recipe.id,
        name: recipe.name,
        createdAt: recipe.createdAt,
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

function presentFeedLog(log: DemoFeedLog) {
  return {
    id: log.id,
    lotId: log.lotId,
    lotLabel: log.lotLabelSnapshot,
    recipeId: log.recipeId,
    recipeName: log.recipeNameSnapshot,
    quantityKg: log.quantityKg,
    totalCost: log.totalCostCents === null ? null : log.totalCostCents / 100,
    feedingDate: log.feedingDate,
    createdAt: log.createdAt,
  };
}

const demoRouter: IRouter = Router();

demoRouter.get("/dashboard", (_req, res) => {
  const sortedProducts = productsStore
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const pendingEntries = financeStore.filter((e) => e.status === "pending");
  const recentEntries = financeStore.slice().reverse().slice(0, 5);
  const lowStockProducts = sortedProducts.filter(
    (p) => p.minimumQuantity !== null && p.quantity <= p.minimumQuantity,
  );

  res.json(
    GetDashboardResponse.parse({
      productCount: sortedProducts.length,
      lowStockCount: lowStockProducts.length,
      pendingPayables:
        pendingEntries
          .filter((e) => e.kind === "payable")
          .reduce((s, e) => s + e.amountCents, 0) / 100,
      pendingReceivables:
        pendingEntries
          .filter((e) => e.kind === "receivable")
          .reduce((s, e) => s + e.amountCents, 0) / 100,
      recentFinanceEntries: recentEntries.map(presentFinance),
      lowStockProducts: lowStockProducts.map(presentProduct),
    }),
  );
});

demoRouter.get("/inventory/products", (_req, res) => {
  const sorted = productsStore
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(GetProductsResponse.parse(sorted.map(presentProduct)));
});

demoRouter.post("/inventory/products", (req, res) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const product: DemoProduct = {
    id: allocId(),
    name: parsed.data.name.trim(),
    category: parsed.data.category,
    unit: parsed.data.unit.trim(),
    quantity: parsed.data.quantity,
    minimumQuantity: parsed.data.minimumQuantity ?? null,
    unitCostCents:
      parsed.data.unitCost == null
        ? null
        : Math.round(parsed.data.unitCost * 100),
    createdAt: new Date().toISOString(),
  };
  productsStore.push(product);
  res.status(201).json(CreateProductResponse.parse(presentProduct(product)));
});

demoRouter.patch("/inventory/products/:productId", (req, res) => {
  const params = UpdateProductParams.safeParse(req.params);
  const body = UpdateProductBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const product = productsStore.find((p) => p.id === params.data.productId);
  if (!product) {
    res.status(404).json({ error: "Produto não encontrado." });
    return;
  }
  const usedInRecipe = recipesStore.some((r) =>
    r.ingredients.some((i) => i.productId === product.id),
  );
  if (
    usedInRecipe &&
    ((body.data.category !== undefined && body.data.category !== "feed") ||
      (body.data.unit !== undefined && body.data.unit.toLowerCase() !== "kg"))
  ) {
    res.status(409).json({
      error:
        "Este ingrediente está em uma receita de ração e precisa continuar como Alimentação, em quilos.",
    });
    return;
  }
  if (body.data.name !== undefined) product.name = body.data.name.trim();
  if (body.data.category !== undefined) product.category = body.data.category;
  if (body.data.unit !== undefined) product.unit = body.data.unit.trim();
  if (body.data.minimumQuantity !== undefined) {
    product.minimumQuantity = body.data.minimumQuantity ?? null;
  }
  if (body.data.unitCost !== undefined) {
    product.unitCostCents =
      body.data.unitCost === null
        ? null
        : Math.round(body.data.unitCost * 100);
  }
  res.json(UpdateProductResponse.parse(presentProduct(product)));
});

demoRouter.delete("/inventory/products/:productId", (req, res) => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (movementsStore.some((m) => m.productId === params.data.productId)) {
    res.status(409).json({
      error:
        "Este item tem histórico de estoque e não pode ser apagado. Edite o nome ou mantenha o cadastro.",
    });
    return;
  }
  if (
    recipesStore.some((r) =>
      r.ingredients.some((i) => i.productId === params.data.productId),
    )
  ) {
    res.status(409).json({
      error:
        "Este item faz parte de uma receita de ração. Remova-o da receita antes de excluir o cadastro.",
    });
    return;
  }
  const idx = productsStore.findIndex((p) => p.id === params.data.productId);
  if (idx === -1) {
    res.status(404).json({ error: "Produto não encontrado." });
    return;
  }
  productsStore.splice(idx, 1);
  res.status(204).json(DeleteProductResponse.parse(undefined));
});

demoRouter.get("/inventory/movements", (_req, res) => {
  const rows = movementsStore
    .slice()
    .reverse()
    .map((m) => {
      const p = productsStore.find((x) => x.id === m.productId);
      return {
        id: m.id,
        productId: m.productId,
        productName: p?.name ?? `Produto #${m.productId}`,
        direction: m.direction,
        quantity: m.quantity,
        note: m.note,
        createdAt: m.createdAt,
      };
    });
  res.json(GetMovementsResponse.parse(rows));
});

demoRouter.post("/inventory/movements", (req, res) => {
  const parsed = CreateMovementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const product = productsStore.find((p) => p.id === parsed.data.productId);
  if (!product) {
    res.status(404).json({ error: "Produto não encontrado." });
    return;
  }
  if (
    parsed.data.direction === "out" &&
    product.quantity < parsed.data.quantity
  ) {
    res.status(400).json({ error: "Não há estoque suficiente para essa saída." });
    return;
  }
  product.quantity =
    parsed.data.direction === "in"
      ? roundKg(product.quantity + parsed.data.quantity)
      : roundKg(product.quantity - parsed.data.quantity);

  const movement: DemoMovement = {
    id: allocId(),
    productId: product.id,
    direction: parsed.data.direction,
    quantity: parsed.data.quantity,
    note: parsed.data.note ?? null,
    sourceType: null,
    sourceId: null,
    createdAt: new Date().toISOString(),
  };
  movementsStore.push(movement);
  res.status(201).json(
    CreateMovementResponse.parse({
      ...movement,
      productName: product.name,
    }),
  );
});

demoRouter.delete("/inventory/movements/:movementId", (req, res) => {
  const params = DeleteMovementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const idx = movementsStore.findIndex((m) => m.id === params.data.movementId);
  if (idx === -1) {
    res.status(404).json({ error: "Movimentação não encontrada." });
    return;
  }
  const movement = movementsStore[idx];
  if (movement.sourceType === "feeding") {
    res.status(400).json({
      error:
        "Este movimento pertence a um registro de alimentação. Exclua o registro pela página de alimentação para restaurar o estoque.",
    });
    return;
  }
  const product = productsStore.find((p) => p.id === movement.productId);
  if (!product) {
    res.status(404).json({ error: "Produto não encontrado." });
    return;
  }
  const nextQuantity =
    movement.direction === "in"
      ? roundKg(product.quantity - movement.quantity)
      : roundKg(product.quantity + movement.quantity);
  if (nextQuantity < 0) {
    res.status(400).json({
      error:
        "Não é possível desfazer esta entrada porque o estoque atual ficaria negativo.",
    });
    return;
  }
  product.quantity = nextQuantity;
  movementsStore.splice(idx, 1);
  res.status(204).json(DeleteMovementResponse.parse(undefined));
});

demoRouter.get("/finance/entries", (_req, res) => {
  const sorted = financeStore
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  res.json(GetFinanceEntriesResponse.parse(sorted.map(presentFinance)));
});

demoRouter.post("/finance/entries", (req, res) => {
  const parsed = CreateFinanceEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const entry: DemoFinanceEntry = {
    id: allocId(),
    kind: parsed.data.kind,
    description: parsed.data.description.trim(),
    amountCents: Math.round(parsed.data.amount * 100),
    dueDate: dateForDatabase(parsed.data.dueDate),
    status: "pending",
    category: parsed.data.category?.trim() || null,
    createdAt: new Date().toISOString(),
    settledAt: null,
  };
  financeStore.push(entry);
  res.status(201).json(CreateFinanceEntryResponse.parse(presentFinance(entry)));
});

demoRouter.patch("/finance/entries/:entryId", (req, res) => {
  const params = UpdateFinanceEntryParams.safeParse(req.params);
  const body = UpdateFinanceEntryBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const entry = financeStore.find((e) => e.id === params.data.entryId);
  if (!entry) {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }
  if (body.data.description !== undefined) {
    entry.description = body.data.description.trim();
  }
  if (body.data.amount !== undefined) {
    entry.amountCents = Math.round(body.data.amount * 100);
  }
  if (body.data.dueDate !== undefined) {
    entry.dueDate = dateForDatabase(body.data.dueDate);
  }
  if (body.data.category !== undefined) {
    entry.category = body.data.category.trim() || null;
  }
  if (body.data.status !== undefined) {
    entry.status = body.data.status;
    entry.settledAt =
      body.data.status === "settled" ? new Date().toISOString() : null;
  }
  res.json(UpdateFinanceEntryResponse.parse(presentFinance(entry)));
});

demoRouter.delete("/finance/entries/:entryId", (req, res) => {
  const params = DeleteFinanceEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const idx = financeStore.findIndex((e) => e.id === params.data.entryId);
  if (idx === -1) {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }
  financeStore.splice(idx, 1);
  res.status(204).json(DeleteFinanceEntryResponse.parse(undefined));
});

demoRouter.get("/poultry/summary", (_req, res) => {
  res.json(
    GetPoultrySummaryResponse.parse({
      activeLotCount: poultryLotsStore.filter((l) => l.currentCount > 0).length,
      liveBirdCount: poultryLotsStore.reduce((s, l) => s + l.currentCount, 0),
    }),
  );
});

demoRouter.get("/poultry/lots", (_req, res) => {
  const sorted = poultryLotsStore
    .slice()
    .sort(
      (a, b) =>
        b.receivedAt.localeCompare(a.receivedAt) || b.id - a.id,
    );
  res.json(GetPoultryLotsResponse.parse(sorted));
});

demoRouter.post("/poultry/lots", (req, res) => {
  const parsed = CreatePoultryLotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const receivedAt = dateForDatabase(parsed.data.receivedAt);
  const nowIso = new Date().toISOString();
  const lot: DemoPoultryLot = {
    id: allocId(),
    label: parsed.data.label.trim(),
    kind: parsed.data.kind,
    receivedAt,
    source: parsed.data.source?.trim() || null,
    breed: parsed.data.breed?.trim() || null,
    ageWeeks: parsed.data.ageWeeks ?? null,
    initialCount: parsed.data.initialCount,
    currentCount: parsed.data.initialCount,
    createdAt: nowIso,
  };
  poultryLotsStore.push(lot);
  poultryMovementsStore.push({
    id: allocId(),
    lotId: lot.id,
    direction: "in",
    quantity: parsed.data.initialCount,
    movementDate: receivedAt,
    counterparty: parsed.data.source?.trim() || null,
    reason: null,
    createdAt: nowIso,
  });
  res.status(201).json(CreatePoultryLotResponse.parse(lot));
});

demoRouter.patch("/poultry/lots/:lotId", (req, res) => {
  const params = UpdatePoultryLotParams.safeParse(req.params);
  const body = UpdatePoultryLotBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const lot = poultryLotsStore.find((l) => l.id === params.data.lotId);
  if (!lot) {
    res.status(404).json({ error: "Lote não encontrado." });
    return;
  }
  if (body.data.label !== undefined) lot.label = body.data.label.trim();
  if (body.data.source !== undefined) {
    lot.source = body.data.source?.trim() || null;
  }
  if (body.data.breed !== undefined) {
    lot.breed = body.data.breed?.trim() || null;
  }
  if (body.data.ageWeeks !== undefined) {
    lot.ageWeeks = body.data.ageWeeks ?? null;
  }
  res.json(UpdatePoultryLotResponse.parse(lot));
});

demoRouter.post("/poultry/lots/:lotId/dispatches", (req, res) => {
  const params = CreatePoultryDispatchParams.safeParse(req.params);
  const body = CreatePoultryDispatchBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const lot = poultryLotsStore.find((l) => l.id === params.data.lotId);
  if (!lot) {
    res.status(404).json({ error: "Lote não encontrado." });
    return;
  }
  if (body.data.quantity > lot.currentCount) {
    res.status(400).json({
      error:
        "A quantidade de saída não pode ser maior que as aves disponíveis no lote.",
    });
    return;
  }
  lot.currentCount -= body.data.quantity;
  const movement: DemoPoultryMovement = {
    id: allocId(),
    lotId: lot.id,
    direction: "out",
    quantity: body.data.quantity,
    movementDate: dateForDatabase(body.data.movementDate),
    counterparty: body.data.counterparty?.trim() || null,
    reason: body.data.reason,
    createdAt: new Date().toISOString(),
  };
  poultryMovementsStore.push(movement);
  res.status(201).json(
    CreatePoultryDispatchResponse.parse({
      ...movement,
      lotLabel: lot.label,
    }),
  );
});

demoRouter.get("/poultry/movements", (_req, res) => {
  const rows = poultryMovementsStore
    .slice()
    .sort(
      (a, b) =>
        b.movementDate.localeCompare(a.movementDate) || b.id - a.id,
    )
    .map((m) => {
      const lot = poultryLotsStore.find((l) => l.id === m.lotId);
      return {
        ...m,
        lotLabel: lot?.label ?? `Lote #${m.lotId}`,
      };
    });
  res.json(GetPoultryMovementsResponse.parse(rows));
});

demoRouter.delete("/poultry/movements/:movementId", (req, res) => {
  const params = DeletePoultryMovementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const idx = poultryMovementsStore.findIndex(
    (m) => m.id === params.data.movementId,
  );
  if (idx === -1) {
    res.status(404).json({ error: "Movimentação não encontrada." });
    return;
  }
  const movement = poultryMovementsStore[idx];
  if (movement.direction === "in") {
    res.status(400).json({
      error:
        "A chegada inicial não pode ser excluída. Edite os dados do lote ou registre uma saída para corrigir a quantidade.",
    });
    return;
  }
  const lot = poultryLotsStore.find((l) => l.id === movement.lotId);
  if (lot) {
    lot.currentCount += movement.quantity;
  }
  poultryMovementsStore.splice(idx, 1);
  res.status(204).json(DeletePoultryMovementResponse.parse(undefined));
});

demoRouter.get("/feeding/summary", (_req, res) => {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  const todayLogs = feedingLogsStore.filter((l) => l.feedingDate === today);
  const monthLogs = feedingLogsStore.filter(
    (l) => l.feedingDate >= monthStart && l.feedingDate <= today,
  );
  const sumCost = (items: DemoFeedLog[]) =>
    items.some((i) => i.totalCostCents === null)
      ? null
      : items.reduce((s, i) => s + (i.totalCostCents ?? 0), 0) / 100;

  res.json(
    GetFeedingSummaryResponse.parse({
      todayQuantityKg: todayLogs.reduce((s, l) => s + l.quantityKg, 0),
      todayCost: sumCost(todayLogs),
      monthCost: sumCost(monthLogs),
      logsToday: todayLogs.length,
    }),
  );
});

demoRouter.get("/feeding/recipes", (_req, res) => {
  res.json(GetFeedRecipesResponse.parse(presentRecipes()));
});

demoRouter.post("/feeding/recipes", (req, res) => {
  const body = CreateFeedRecipeBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const uniqueIds = new Set(body.data.ingredients.map((i) => i.productId));
  if (uniqueIds.size !== body.data.ingredients.length) {
    res.status(400).json({
      error: "Cada ingrediente deve aparecer uma única vez na receita.",
    });
    return;
  }
  const validProducts = body.data.ingredients.every((ing) => {
    const p = productsStore.find((x) => x.id === ing.productId);
    return p && p.category === "feed" && p.unit.toLowerCase() === "kg";
  });
  if (!validProducts) {
    res.status(400).json({
      error: "Use ingredientes cadastrados como Alimentação, medidos em quilos.",
    });
    return;
  }
  const recipe: DemoFeedRecipe = {
    id: allocId(),
    name: body.data.name.trim(),
    createdAt: new Date().toISOString(),
    ingredients: body.data.ingredients.map((i) => ({
      productId: i.productId,
      quantityKg: i.quantityKg,
    })),
  };
  recipesStore.push(recipe);
  const created = presentRecipes().find((r) => r.id === recipe.id);
  res.status(201).json(CreateFeedRecipeResponse.parse(created));
});

demoRouter.patch("/feeding/recipes/:recipeId", (req, res) => {
  const params = UpdateFeedRecipeParams.safeParse(req.params);
  const body = UpdateFeedRecipeBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const recipe = recipesStore.find((r) => r.id === params.data.recipeId);
  if (!recipe) {
    res.status(404).json({ error: "Receita não encontrada." });
    return;
  }
  const uniqueIds = new Set(body.data.ingredients.map((i) => i.productId));
  if (uniqueIds.size !== body.data.ingredients.length) {
    res.status(400).json({
      error: "Cada ingrediente deve aparecer uma única vez na receita.",
    });
    return;
  }
  const validProducts = body.data.ingredients.every((ing) => {
    const p = productsStore.find((x) => x.id === ing.productId);
    return p && p.category === "feed" && p.unit.toLowerCase() === "kg";
  });
  if (!validProducts) {
    res.status(400).json({
      error: "Use ingredientes cadastrados como Alimentação, medidos em quilos.",
    });
    return;
  }
  recipe.name = body.data.name.trim();
  recipe.ingredients = body.data.ingredients.map((i) => ({
    productId: i.productId,
    quantityKg: i.quantityKg,
  }));
  const updated = presentRecipes().find((r) => r.id === recipe.id);
  res.json(UpdateFeedRecipeResponse.parse(updated));
});

demoRouter.delete("/feeding/recipes/:recipeId", (req, res) => {
  const params = DeleteFeedRecipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const idx = recipesStore.findIndex((r) => r.id === params.data.recipeId);
  if (idx === -1) {
    res.status(404).json({ error: "Receita não encontrada." });
    return;
  }
  if (feedingLogsStore.some((l) => l.recipeId === params.data.recipeId)) {
    res.status(409).json({
      error:
        "Esta receita já foi usada. Mantenha o histórico e crie outra receita se necessário.",
    });
    return;
  }
  recipesStore.splice(idx, 1);
  res.status(204).json(DeleteFeedRecipeResponse.parse(undefined));
});

demoRouter.get("/feeding/logs", (_req, res) => {
  const sorted = feedingLogsStore
    .slice()
    .sort(
      (a, b) =>
        b.feedingDate.localeCompare(a.feedingDate) || b.id - a.id,
    );
  res.json(GetFeedLogsResponse.parse(sorted.map(presentFeedLog)));
});

demoRouter.post("/feeding/logs", (req, res) => {
  const body = CreateFeedLogBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const lot = poultryLotsStore.find((l) => l.id === body.data.lotId);
  if (!lot) {
    res.status(404).json({ error: "Lote de aves não encontrado." });
    return;
  }
  if (lot.currentCount === 0) {
    res.status(400).json({
      error: "Não é possível registrar alimentação para um lote sem aves.",
    });
    return;
  }
  const recipe = recipesStore.find((r) => r.id === body.data.recipeId);
  if (!recipe) {
    res.status(404).json({ error: "Receita de ração não encontrada." });
    return;
  }
  const batchWeightKg = recipe.ingredients.reduce(
    (s, i) => s + i.quantityKg,
    0,
  );
  if (batchWeightKg <= 0) {
    res.status(400).json({ error: "A receita não possui ingredientes válidos." });
    return;
  }

  const allocations: Array<{ product: DemoProduct; quantityUsed: number }> = [];
  for (const ing of recipe.ingredients) {
    const product = productsStore.find((p) => p.id === ing.productId);
    if (!product) {
      res.status(400).json({ error: "Ingrediente inválido." });
      return;
    }
    const quantityUsed = roundKg(
      (body.data.quantityKg * ing.quantityKg) / batchWeightKg,
    );
    if (product.quantity + 0.0000001 < quantityUsed) {
      res.status(400).json({
        error: `Estoque insuficiente de ${product.name} para essa alimentação.`,
      });
      return;
    }
    allocations.push({ product, quantityUsed });
  }

  const totalCostCents = allocations.some(
    ({ product }) => product.unitCostCents === null,
  )
    ? null
    : allocations.reduce(
        (sum, { product, quantityUsed }) =>
          sum + Math.round(quantityUsed * (product.unitCostCents ?? 0)),
        0,
      );

  const nowIso = new Date().toISOString();
  const log: DemoFeedLog = {
    id: allocId(),
    lotId: lot.id,
    recipeId: recipe.id,
    lotLabelSnapshot: lot.label,
    recipeNameSnapshot: recipe.name,
    quantityKg: body.data.quantityKg,
    totalCostCents,
    feedingDate: dateForDatabase(body.data.feedingDate),
    createdAt: nowIso,
  };
  feedingLogsStore.push(log);

  for (const { product, quantityUsed } of allocations) {
    product.quantity = roundKg(product.quantity - quantityUsed);
    movementsStore.push({
      id: allocId(),
      productId: product.id,
      direction: "out",
      quantity: quantityUsed,
      note: `Alimentação · ${recipe.name} · ${lot.label}`,
      sourceType: "feeding",
      sourceId: log.id,
      createdAt: nowIso,
    });
  }

  res.status(201).json(CreateFeedLogResponse.parse(presentFeedLog(log)));
});

demoRouter.delete("/feeding/logs/:logId", (req, res) => {
  const params = DeleteFeedLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const idx = feedingLogsStore.findIndex((l) => l.id === params.data.logId);
  if (idx === -1) {
    res.status(404).json({ error: "Registro de alimentação não encontrado." });
    return;
  }
  const log = feedingLogsStore[idx];
  const relatedMoves = movementsStore.filter(
    (m) => m.sourceType === "feeding" && m.sourceId === log.id,
  );
  for (const move of relatedMoves) {
    const product = productsStore.find((p) => p.id === move.productId);
    if (product) {
      product.quantity = roundKg(product.quantity + move.quantity);
    }
  }
  movementsStore = movementsStore.filter(
    (m) => !(m.sourceType === "feeding" && m.sourceId === log.id),
  );
  feedingLogsStore.splice(idx, 1);
  res.status(204).json(DeleteFeedLogResponse.parse(undefined));
});

export default demoRouter;
