import crypto from "node:crypto";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
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

export const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://nkvcfyqttjrlovsxvnkv.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rdmNmeXF0dGpybG92c3h2bmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMTc0MjIsImV4cCI6MjEwODU5MzQyMn0.tWnv9Dc3jkSrh64LEnQHeNdcCPHX8Uvhw7I9iGOLQqQ";

const AUTH_SECRET =
  process.env.AUTH_SECRET || "granja-suenaga-secret-key-2026-supabase";

export async function sbFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase error (${res.status}): ${errText}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ============================================================================
// Authentication helpers & token signing
// ============================================================================
export function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(`granja_suenaga_salt:${password}`)
    .digest("hex");
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (storedHash === password) return true;
  return hashPassword(password) === storedHash;
}

export interface AuthUserPayload {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

export function createAuthToken(user: AuthUserPayload): string {
  const payload = Buffer.from(JSON.stringify(user), "utf8").toString(
    "base64url",
  );
  const sig = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAuthToken(token: string | undefined | null): AuthUserPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(payload)
    .digest("base64url");
  if (sig !== expectedSig) return null;
  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as AuthUserPayload;
  } catch {
    return null;
  }
}

export function extractRequestToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const customHeader = req.headers["x-auth-token"];
  if (typeof customHeader === "string" && customHeader.trim()) {
    return customHeader.trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("granja_token="));
    if (match) {
      return decodeURIComponent(match.slice("granja_token=".length));
    }
  }
  return null;
}

export function requireAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = extractRequestToken(req);
  const user = verifyAuthToken(token);
  if (!user) {
    res.status(401).json({
      error: "Acesso protegido. Faça login para acessar o sistema da Granja Suenaga.",
    });
    return;
  }
  (req as Request & { user?: AuthUserPayload }).user = user;
  next();
}

// ============================================================================
// Database row types (snake_case from Supabase PostgreSQL)
// ============================================================================
interface SbUserRow {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  role: string;
  created_at: string;
}

interface SbProductRow {
  id: number;
  name: string;
  category: "feed" | "medicine" | "supplies" | "equipment" | "other";
  unit: string;
  quantity: number;
  minimum_quantity: number | null;
  unit_cost_cents: number | null;
  image_data?: string | null;
  image_signature?: string | null;
  created_at: string;
}

interface SbMovementRow {
  id: number;
  product_id: number;
  direction: "in" | "out";
  quantity: number;
  note: string | null;
  source_type: string | null;
  source_id: number | null;
  created_at: string;
}

interface SbFinanceRow {
  id: number;
  kind: "payable" | "receivable";
  description: string;
  amount_cents: number;
  due_date: string;
  status: "pending" | "settled";
  category: string | null;
  created_at: string;
  settled_at: string | null;
}

interface SbPoultryLotRow {
  id: number;
  label: string;
  kind: "layers" | "broilers" | "chicks" | "other";
  received_at: string;
  source: string | null;
  breed: string | null;
  age_weeks: number | null;
  initial_count: number;
  current_count: number;
  created_at: string;
}

interface SbPoultryMovementRow {
  id: number;
  lot_id: number;
  direction: "in" | "out";
  quantity: number;
  movement_date: string;
  counterparty: string | null;
  reason: "sale" | "transfer" | "mortality" | "other" | null;
  created_at: string;
}

interface SbRecipeRow {
  id: number;
  name: string;
  created_at: string;
}

interface SbRecipeIngredientRow {
  id: number;
  recipe_id: number;
  product_id: number;
  quantity_kg: number;
}

interface SbFeedingLogRow {
  id: number;
  lot_id: number;
  recipe_id: number;
  lot_label_snapshot: string;
  recipe_name_snapshot: string;
  quantity_kg: number;
  total_cost_cents: number | null;
  feeding_date: string;
  created_at: string;
}

const roundKg = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const dateForDatabase = (value: Date) => value.toISOString().slice(0, 10);
const toIsoTimestamp = (raw: string) => new Date(raw).toISOString();

function presentProduct(p: SbProductRow) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    unit: p.unit,
    quantity: Number(p.quantity),
    minimumQuantity:
      p.minimum_quantity === null ? null : Number(p.minimum_quantity),
    unitCost:
      p.unit_cost_cents === null ? null : Number(p.unit_cost_cents) / 100,
    imageData: p.image_data ?? null,
    imageSignature: p.image_signature ?? null,
    createdAt: toIsoTimestamp(p.created_at),
  };
}

function presentFinance(e: SbFinanceRow) {
  return {
    id: e.id,
    kind: e.kind,
    description: e.description,
    amount: Number(e.amount_cents) / 100,
    dueDate: e.due_date,
    status: e.status,
    category: e.category,
    createdAt: toIsoTimestamp(e.created_at),
    settledAt: e.settled_at ? toIsoTimestamp(e.settled_at) : null,
  };
}

function presentLot(l: SbPoultryLotRow) {
  return {
    id: l.id,
    label: l.label,
    kind: l.kind,
    receivedAt: l.received_at,
    source: l.source,
    breed: l.breed,
    ageWeeks: l.age_weeks,
    initialCount: l.initial_count,
    currentCount: l.current_count,
    createdAt: toIsoTimestamp(l.created_at),
  };
}

function presentPoultryMovement(m: SbPoultryMovementRow, lotLabel: string) {
  return {
    id: m.id,
    lotId: m.lot_id,
    lotLabel,
    direction: m.direction,
    quantity: m.quantity,
    movementDate: m.movement_date,
    counterparty: m.counterparty,
    reason: m.reason,
    createdAt: toIsoTimestamp(m.created_at),
  };
}

function presentFeedLog(log: SbFeedingLogRow) {
  return {
    id: log.id,
    lotId: log.lot_id,
    lotLabel: log.lot_label_snapshot,
    recipeId: log.recipe_id,
    recipeName: log.recipe_name_snapshot,
    quantityKg: Number(log.quantity_kg),
    totalCost:
      log.total_cost_cents === null ? null : Number(log.total_cost_cents) / 100,
    feedingDate: log.feeding_date,
    createdAt: toIsoTimestamp(log.created_at),
  };
}

async function loadRecipesFromSupabase() {
  const [recipes, ingredients, products] = await Promise.all([
    sbFetch<SbRecipeRow[]>("farm_feed_recipes?select=*&order=name.asc"),
    sbFetch<SbRecipeIngredientRow[]>(
      "farm_feed_recipe_ingredients?select=*&order=id.asc",
    ),
    sbFetch<SbProductRow[]>("farm_products?select=*"),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));

  return recipes.map((recipe) => {
    const recipeIngredients = ingredients
      .filter((i) => i.recipe_id === recipe.id)
      .map((i) => {
        const prod = productMap.get(i.product_id);
        const unitCostCents = prod?.unit_cost_cents ?? null;
        return {
          productId: i.product_id,
          productName: prod?.name ?? `Produto #${i.product_id}`,
          quantityKg: Number(i.quantity_kg),
          unitCost: unitCostCents === null ? null : unitCostCents / 100,
          lineCost:
            unitCostCents === null
              ? null
              : Math.round(Number(i.quantity_kg) * unitCostCents) / 100,
          availableQuantity: Number(prod?.quantity ?? 0),
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
      createdAt: toIsoTimestamp(recipe.created_at),
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

// ============================================================================
// Auth Router (/api/auth/*)
// ============================================================================
export const authRouter: IRouter = Router();

authRouter.post("/auth/login", async (req, res) => {
  try {
    const rawUsername = String(req.body?.username ?? "")
      .trim()
      .toLowerCase();
    const rawPassword = String(req.body?.password ?? "").trim();

    if (!rawUsername || !rawPassword) {
      res.status(400).json({ error: "Informe o usuário e a senha." });
      return;
    }

    const users = await sbFetch<SbUserRow[]>(
      `farm_users?username=eq.${encodeURIComponent(rawUsername)}&select=*&limit=1`,
    );
    const user = users[0];

    if (!user || !verifyPassword(rawPassword, user.password_hash)) {
      res.status(401).json({ error: "Usuário ou senha incorretos." });
      return;
    }

    const payload: AuthUserPayload = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    };
    const token = createAuthToken(payload);

    res.setHeader(
      "Set-Cookie",
      `granja_token=${encodeURIComponent(token)}; Path=/; Max-Age=604800; SameSite=Lax`,
    );
    res.json({ token, user: payload });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao realizar login.",
    });
  }
});

authRouter.post("/auth/register", async (req, res) => {
  try {
    const rawUsername = String(req.body?.username ?? "")
      .trim()
      .toLowerCase();
    const displayName = String(
      req.body?.displayName || req.body?.username || "",
    ).trim();
    const rawPassword = String(req.body?.password ?? "").trim();

    if (!rawUsername || rawUsername.length < 3) {
      res
        .status(400)
        .json({ error: "O nome de usuário deve ter pelo menos 3 letras." });
      return;
    }
    if (!rawPassword || rawPassword.length < 4) {
      res
        .status(400)
        .json({ error: "A senha deve ter pelo menos 4 caracteres." });
      return;
    }

    const existing = await sbFetch<SbUserRow[]>(
      `farm_users?username=eq.${encodeURIComponent(rawUsername)}&select=id&limit=1`,
    );
    if (existing.length > 0) {
      res
        .status(409)
        .json({ error: "Este nome de usuário já está cadastrado." });
      return;
    }

    const created = await sbFetch<SbUserRow[]>("farm_users", {
      method: "POST",
      body: JSON.stringify({
        username: rawUsername,
        display_name: displayName || rawUsername,
        password_hash: hashPassword(rawPassword),
        role: "admin",
      }),
    });

    const user = created[0];
    const payload: AuthUserPayload = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    };
    const token = createAuthToken(payload);

    res.setHeader(
      "Set-Cookie",
      `granja_token=${encodeURIComponent(token)}; Path=/; Max-Age=604800; SameSite=Lax`,
    );
    res.status(201).json({ token, user: payload });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao criar usuário.",
    });
  }
});

authRouter.get("/auth/me", (req, res) => {
  const token = extractRequestToken(req);
  const user = verifyAuthToken(token);
  if (!user) {
    res.status(401).json({ authenticated: false, user: null });
    return;
  }
  if (user.username === "suenaga" && user.displayName === "Granja Suenaga") {
    user.displayName = "Granja Gabriel Suenaga";
  }
  res.json({ authenticated: true, user });
});

authRouter.post("/auth/logout", (_req, res) => {
  res.setHeader(
    "Set-Cookie",
    "granja_token=; Path=/; Max-Age=0; SameSite=Lax",
  );
  res.json({ status: "ok" });
});

// ============================================================================
// Supabase REST Router for all Farm / Poultry / Feeding / Finance routes
// ============================================================================
export const supabaseRestRouter: IRouter = Router();

supabaseRestRouter.get("/dashboard", async (_req, res) => {
  const [products, pendingEntries, recentEntries] = await Promise.all([
    sbFetch<SbProductRow[]>("farm_products?select=*&order=name.asc"),
    sbFetch<SbFinanceRow[]>(
      "farm_finance_entries?status=eq.pending&select=*",
    ),
    sbFetch<SbFinanceRow[]>(
      "farm_finance_entries?select=*&order=created_at.desc&limit=5",
    ),
  ]);

  const lowStockProducts = products.filter(
    (p) =>
      p.minimum_quantity !== null &&
      Number(p.quantity) <= Number(p.minimum_quantity),
  );

  res.json(
    GetDashboardResponse.parse({
      productCount: products.length,
      lowStockCount: lowStockProducts.length,
      pendingPayables:
        pendingEntries
          .filter((e) => e.kind === "payable")
          .reduce((s, e) => s + Number(e.amount_cents), 0) / 100,
      pendingReceivables:
        pendingEntries
          .filter((e) => e.kind === "receivable")
          .reduce((s, e) => s + Number(e.amount_cents), 0) / 100,
      recentFinanceEntries: recentEntries.map(presentFinance),
      lowStockProducts: lowStockProducts.map(presentProduct),
    }),
  );
});

supabaseRestRouter.get("/inventory/products", async (_req, res) => {
  const products = await sbFetch<SbProductRow[]>(
    "farm_products?select=*&order=name.asc",
  );
  res.json(GetProductsResponse.parse(products.map(presentProduct)));
});

supabaseRestRouter.post("/inventory/products", async (req, res) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [product] = await sbFetch<SbProductRow[]>("farm_products", {
    method: "POST",
    body: JSON.stringify({
      name: parsed.data.name.trim(),
      category: parsed.data.category,
      unit: parsed.data.unit.trim(),
      quantity: parsed.data.quantity,
      minimum_quantity: parsed.data.minimumQuantity ?? null,
      unit_cost_cents:
        parsed.data.unitCost == null
          ? null
          : Math.round(parsed.data.unitCost * 100),
      image_data: parsed.data.imageData ?? null,
      image_signature: parsed.data.imageSignature ?? null,
    }),
  });
  res.status(201).json(CreateProductResponse.parse(presentProduct(product)));
});

interface ParsedSignature {
  v?: number[];
  rgb?: [number, number, number];
  std?: number;
  fn?: string;
}

function parseImageSignature(raw: string | undefined | null): ParsedSignature | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ParsedSignature;
  } catch {
    return null;
  }
}

function computeSignatureSimilarity(a: ParsedSignature, b: ParsedSignature): number {
  if (!a.v || !b.v || a.v.length !== b.v.length || a.v.length === 0) {
    return 0;
  }
  let sumAbsDiff = 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.v.length; i++) {
    const va = a.v[i];
    const vb = b.v[i];
    sumAbsDiff += Math.abs(va - vb);
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  const maeSim = Math.max(0, 1 - sumAbsDiff / (a.v.length * 255));
  const cosSim =
    normA > 0 && normB > 0 ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
  return maeSim * 0.65 + cosSim * 0.35;
}

interface VisionAnalysis {
  name: string;
  category: "feed" | "medicine" | "supplies" | "equipment" | "other";
  unit: string;
  quantity: number;
  minimumQuantity: number;
  unitCost?: number;
  reason: string;
}

async function analyzeWithGeminiVision(
  imageData: string,
  apiKey: string,
  existingProductNames: string[],
): Promise<VisionAnalysis | null> {
  try {
    let pureBase64 = imageData;
    let mimeType = "image/jpeg";
    if (imageData.startsWith("data:")) {
      const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        pureBase64 = match[2];
      }
    }

    const prompt = `Você é o sistema de visão computacional da Granja Suenaga (granja avícola e agropecuária).
Analise com precisão a foto deste produto, insumo, recipiente ou equipamento.

Produtos já cadastrados no estoque da granja:
${existingProductNames.slice(0, 15).join(", ")}

INSTRUÇÕES OBRIGATÓRIAS:
1. "name": Nome claro, específico e em português do item fotografado.
   Exemplos: "Garrafas Plásticas / Squeeze", "Bebedouro Tipo Garrafa", "Frasco de Vacina", "Ração Postura", "Milho em Grão".
2. "category": Escolha rigorosamente uma das opções abaixo:
   - "equipment" (se for garrafas, bebedouros, comedouros, lâmpadas, campânulas, ferramentas)
   - "medicine" (se for vacinas, remédios, antibióticos, vitaminas, ampolas)
   - "feed" (se for ração, grãos, milho, soja, calcário, núcleos)
   - "supplies" (se for embalagens, caixas, cartelas de ovos, maravalha, desinfetantes)
   - "other" (se não se encaixar nas anteriores)
3. "quantity": CONTAGEM EXATA de itens na imagem:
   - Se houver 3 garrafas ou frascos visíveis na imagem, a quantidade DEVE ser 3.
   - Se for um saco ou embalagem fechada, use o peso/volume indicado no rótulo (ex: 50 se for saco de 50kg, 500 se for frasco de 500ml). Se não houver número, use 1.
4. "unit":
   - "un" (se forem objetos ou recipientes contados por unidade, como garrafas, potes, caixas, bebedouros)
   - "ml" (se for líquido pequeno, ex: frasco até 1000ml)
   - "L" (se for líquido grande, ex: galão de desinfetante)
   - "g" (se for sólido pequeno, pó ou sachê)
   - "kg" (se for ração, sacos de grãos ou calcário)
5. "minimumQuantity": SEMPRE 0.
6. "unitCost": Estimativa de custo unitário em Reais (R$), se aplicável.
7. "reason": Frase curta e objetiva em português explicando o que a IA identificou (ex: "Detectadas 3 garrafas na imagem (3 unidades, Equipamentos).").

Retorne EXCLUSIVAMENTE um objeto JSON válido, sem texto adicional ou markdown. Formato:
{
  "name": string,
  "category": "feed" | "medicine" | "supplies" | "equipment" | "other",
  "unit": "un" | "kg" | "g" | "L" | "ml",
  "quantity": number,
  "minimumQuantity": 0,
  "unitCost": number,
  "reason": string
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: pureBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      console.warn("Gemini Vision response not OK:", response.status, await response.text());
      return null;
    }

    const json = (await response.json()) as any;
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text.trim());
    return {
      name: String(parsed.name || "Item Identificado").trim(),
      category: ["feed", "medicine", "supplies", "equipment", "other"].includes(parsed.category)
        ? parsed.category
        : "equipment",
      unit: String(parsed.unit || "un"),
      quantity: Number(parsed.quantity) > 0 ? Number(parsed.quantity) : 1,
      minimumQuantity: 0,
      unitCost: typeof parsed.unitCost === "number" ? parsed.unitCost : undefined,
      reason: String(parsed.reason || "Item identificado com Gemini Vision."),
    };
  } catch (err) {
    console.error("Gemini Vision failed:", err);
    return null;
  }
}

async function analyzeWithOpenAiVision(
  imageData: string,
  apiKey: string,
  existingProductNames: string[],
): Promise<VisionAnalysis | null> {
  try {
    const prompt = `Você é o sistema de visão computacional da Granja Suenaga.
Analise a foto deste item de granja e retorne APENAS um JSON:
{
  "name": "Nome descritivo",
  "category": "feed" | "medicine" | "supplies" | "equipment" | "other",
  "unit": "un" | "kg" | "g" | "L" | "ml",
  "quantity": <contagem exata ou volume/peso>,
  "minimumQuantity": 0,
  "unitCost": <opcional em R$>,
  "reason": "Explicação em português"
}
Regras: se forem garrafas/recipientes conte a quantidade exata (ex: 3 garrafas -> quantity=3, unit="un", category="equipment"). Produtos já no banco: ${existingProductNames.slice(0, 10).join(", ")}.`;

    const url = "https://api.openai.com/v1/chat/completions";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageData } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) return null;
    const json = (await response.json()) as any;
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content.trim());
    return {
      name: String(parsed.name || "Item Identificado").trim(),
      category: ["feed", "medicine", "supplies", "equipment", "other"].includes(parsed.category)
        ? parsed.category
        : "equipment",
      unit: String(parsed.unit || "un"),
      quantity: Number(parsed.quantity) > 0 ? Number(parsed.quantity) : 1,
      minimumQuantity: 0,
      unitCost: typeof parsed.unitCost === "number" ? parsed.unitCost : undefined,
      reason: String(parsed.reason || "Item identificado com OpenAI Vision."),
    };
  } catch (err) {
    console.error("OpenAI Vision failed:", err);
    return null;
  }
}

supabaseRestRouter.post("/inventory/analyze-image", async (req, res) => {
  try {
    const rawSignature = String(req.body?.imageSignature ?? "");
    const rawFileName = String(req.body?.fileName ?? "").toLowerCase();
    const sig = parseImageSignature(rawSignature);

    const products = await sbFetch<SbProductRow[]>(
      "farm_products?select=*&order=id.desc",
    );

    // 0. Check for Vision AI API keys (Google Gemini or OpenAI)
    const geminiKey =
      (typeof req.body?.geminiApiKey === "string" && req.body.geminiApiKey.trim()) ||
      (typeof req.headers["x-gemini-api-key"] === "string" &&
        (req.headers["x-gemini-api-key"] as string).trim()) ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "";

    const openAiKey =
      (typeof req.body?.openAiApiKey === "string" && req.body.openAiApiKey.trim()) ||
      (typeof req.headers["x-openai-api-key"] === "string" &&
        (req.headers["x-openai-api-key"] as string).trim()) ||
      process.env.OPENAI_API_KEY ||
      "";

    const rawImageData =
      typeof req.body?.imageData === "string" && req.body.imageData.startsWith("data:")
        ? req.body.imageData
        : "";

    if (rawImageData && (geminiKey || openAiKey)) {
      const existingNames = products.map((p) => p.name);
      let visionResult: VisionAnalysis | null = null;
      if (geminiKey) {
        visionResult = await analyzeWithGeminiVision(rawImageData, geminiKey, existingNames);
      }
      if (!visionResult && openAiKey) {
        visionResult = await analyzeWithOpenAiVision(rawImageData, openAiKey, existingNames);
      }

      if (visionResult) {
        // Check if there is an existing database product with matching name
        const matchInDb = products.find(
          (p) =>
            p.name.toLowerCase() === visionResult!.name.toLowerCase() ||
            p.name.toLowerCase().includes(visionResult!.name.toLowerCase()) ||
            visionResult!.name.toLowerCase().includes(p.name.toLowerCase()),
        );

        res.json({
          matchedInDb: !!matchInDb,
          similarity: matchInDb ? 95 : 0,
          matchedProduct: matchInDb ? presentProduct(matchInDb) : null,
          suggestion: {
            name: visionResult.name,
            category: visionResult.category,
            unit: visionResult.unit,
            quantity: visionResult.quantity,
            minimumQuantity: 0,
            unitCost:
              visionResult.unitCost ??
              (matchInDb?.unit_cost ? Number(matchInDb.unit_cost) : 12.0),
            reason: `✨ Visão Computacional por IA: ${visionResult.reason}`,
          },
        });
        return;
      }
    }

    // 1. Quantity & unit detection from text/filename clues
    const fn = `${rawFileName} ${sig?.fn ?? ""}`.toLowerCase();
    let detectedQty: number | null = null;
    let explicitUnit: string | null = null;
    let detectedState: "liquid" | "solid" | "discrete" | null = null;
    let detectedSize: "small" | "large" | null = null;

    // Regex to match quantity + unit (e.g., "500ml", "100 ml", "250g", "5kg", "50kg", "5L", "20l", "10un")
    const qtyUnitRegex =
      /(\d+(?:[.,]\d+)?)\s*(ml|mililitros?|l|litros?|litro|kg|kilos?|quilos?|g|gramas?|sacos?|un|und|unidades?|doses?)\b/i;
    const match = fn.match(qtyUnitRegex);
    if (match) {
      const val = parseFloat(match[1].replace(",", "."));
      const u = match[2].toLowerCase();
      if (!isNaN(val) && val > 0) {
        if (u.startsWith("ml") || u.startsWith("mili")) {
          detectedQty = val;
          explicitUnit = "ml";
          detectedState = "liquid";
          detectedSize = "small";
        } else if (u === "l" || u.startsWith("litro")) {
          detectedState = "liquid";
          if (val <= 0.5) {
            detectedQty = Math.round(val * 1000);
            explicitUnit = "ml";
            detectedSize = "small";
          } else {
            detectedQty = val;
            explicitUnit = "L";
            detectedSize = val >= 5 ? "large" : "small";
          }
        } else if (u.startsWith("g") && !u.startsWith("gra")) {
          detectedQty = val;
          explicitUnit = "g";
          detectedState = "solid";
          detectedSize = "small";
        } else if (
          u.startsWith("kg") ||
          u.startsWith("kilo") ||
          u.startsWith("quilo")
        ) {
          detectedState = "solid";
          if (val < 1) {
            detectedQty = Math.round(val * 1000);
            explicitUnit = "g";
            detectedSize = "small";
          } else {
            detectedQty = val;
            explicitUnit = "kg";
            detectedSize = val >= 10 ? "large" : "small";
          }
        } else if (u.startsWith("un") || u.startsWith("dose")) {
          detectedQty = val;
          explicitUnit = "un";
          detectedState = "discrete";
        } else if (u.startsWith("saco")) {
          detectedQty = val;
          explicitUnit = "saco";
          detectedState = "solid";
          detectedSize = "large";
        }
      }
    }

    // Secondary quantity parser: isolated number in filename (e.g. "remedio_100.png", "milho_50.jpg")
    if (detectedQty === null) {
      const rawNum = fn.match(/(?:^|[^\d])(\d{1,4})(?:[^\d]|$)/);
      if (rawNum) {
        const n = parseInt(rawNum[1], 10);
        if (n > 0 && n < 2000) {
          detectedQty = n;
        }
      }
    }

    // Physical state & size keyword lists
    const liquidKeywords = [
      "liquido",
      "líquido",
      "frasco",
      "gotas",
      "solucao",
      "solução",
      "suspensao",
      "suspensão",
      "xarope",
      "oleo",
      "óleo",
      "injetavel",
      "injetável",
      "soro",
      "desinfetante",
      "detergente",
      "cloro",
      "agua",
      "água",
      "spray",
      "ampola",
      "ml",
      "litro",
      "litros",
    ];
    const solidKeywords = [
      "solido",
      "sólido",
      "po",
      "pó",
      "grao",
      "grão",
      "farelo",
      "calcario",
      "calcário",
      "racao",
      "ração",
      "saco",
      "feno",
      "maravalha",
      "semente",
      "farinha",
      "comprimido",
      "capsula",
      "cápsula",
      "kg",
      "kilo",
      "quilo",
      "grama",
      "gramas",
    ];
    const smallKeywords = [
      "pequeno",
      "pequena",
      "mini",
      "gotas",
      "ampola",
      "frasco",
      "sache",
      "sachê",
      "pote",
      "dose",
      "100ml",
      "250ml",
      "500ml",
      "100g",
      "250g",
    ];
    const largeKeywords = [
      "grande",
      "saco",
      "bombona",
      "balde",
      "tambor",
      "fardo",
      "bigbag",
      "bag",
      "galao",
      "galão",
      "50kg",
      "25kg",
      "5l",
      "20l",
    ];

    const hasLiquidWord = liquidKeywords.some((w) => fn.includes(w));
    const hasSolidWord = solidKeywords.some((w) => fn.includes(w));
    const hasSmallWord = smallKeywords.some((w) => fn.includes(w));
    const hasLargeWord = largeKeywords.some((w) => fn.includes(w));

    // 2. Compare visual signature against all product images already saved in Supabase
    let bestMatch: SbProductRow | null = null;
    let bestSimilarity = 0;

    if (sig && sig.v && sig.v.length > 0) {
      for (const prod of products) {
        if (!prod.image_signature) continue;
        const dbSig = parseImageSignature(prod.image_signature);
        if (!dbSig) continue;
        const sim = computeSignatureSimilarity(sig, dbSig);
        if (sim > bestSimilarity) {
          bestSimilarity = sim;
          bestMatch = prod;
        }
      }
    }

    if (bestMatch && bestSimilarity >= 0.87) {
      const presented = presentProduct(bestMatch);
      const finalUnit = explicitUnit || presented.unit;
      const finalQty = detectedQty ?? presented.quantity ?? 25;
      res.json({
        matchedInDb: true,
        similarity: Math.round(bestSimilarity * 100),
        matchedProduct: presented,
        suggestion: {
          name: presented.name,
          category: presented.category,
          unit: finalUnit,
          quantity: finalQty,
          minimumQuantity: 0, // Estoque mínimo inicia sempre como 0 conforme solicitado
          unitCost: presented.unitCost,
          reason: `Imagem reconhecida no banco (${Math.round(bestSimilarity * 100)}% de semelhança com “${presented.name}”). Quantidade: ${finalQty} ${finalUnit}, estoque mínimo iniciado em 0.`,
        },
      });
      return;
    }

    // 3. Analyze visual features (color profile, luminance, contrast) + category determination
    const [r, g, b] = sig?.rgb ?? [160, 150, 110];
    const std = sig?.std ?? 40;

    type CategoryKey = "feed" | "medicine" | "supplies" | "equipment" | "other";
    let detectedCategory: CategoryKey = "feed";
    let keywordHint = "";
    let fallbackName = "Ração Postura";
    let fallbackCost = 2.4;

    if (fn.includes("calcario") || fn.includes("calcário")) {
      detectedCategory = "feed";
      keywordHint = "calcário";
      fallbackName = "Calcário Calcítico";
      fallbackCost = 0.85;
    } else if (
      fn.includes("desinfetante") ||
      fn.includes("detergente") ||
      fn.includes("cloro") ||
      fn.includes("sanitizante")
    ) {
      detectedCategory = "supplies";
      keywordHint = "desinfetante";
      fallbackName = "Desinfetante / Sanitizante Aviário";
      fallbackCost = 35.0;
    } else if (
      fn.includes("vacina") ||
      fn.includes("remedio") ||
      fn.includes("remédio") ||
      fn.includes("medicamento") ||
      fn.includes("antibiotico") ||
      fn.includes("vitamina") ||
      fn.includes("gotas") ||
      fn.includes("frasco") ||
      fn.includes("ampola")
    ) {
      detectedCategory = "medicine";
      keywordHint = "vacina";
      fallbackName = "Vacina Newcastle + Bronquite";
      fallbackCost = 45.0;
    } else if (
      fn.includes("cartela") ||
      fn.includes("ovo") ||
      fn.includes("embalagem") ||
      fn.includes("maravalha") ||
      fn.includes("insumo")
    ) {
      detectedCategory = "supplies";
      keywordHint = "cartela";
      fallbackName = "Cartelas para 30 Ovos";
      fallbackCost = 0.95;
    } else if (
      fn.includes("garrafa") ||
      fn.includes("garrafas") ||
      fn.includes("frasco") ||
      fn.includes("frascos") ||
      fn.includes("squeeze") ||
      fn.includes("recipiente") ||
      fn.includes("pote") ||
      fn.includes("potes")
    ) {
      detectedCategory = "equipment";
      keywordHint = "garrafa";
      fallbackName = "Garrafas / Recipientes";
      fallbackCost = 15.0;
    } else if (
      fn.includes("comedouro") ||
      fn.includes("bebedouro") ||
      fn.includes("lampada") ||
      fn.includes("campanula") ||
      fn.includes("equipamento")
    ) {
      detectedCategory = "equipment";
      keywordHint = "comedouro";
      fallbackName = "Comedouro / Bebedouro Avícola";
      fallbackCost = 38.0;
    } else if (fn.includes("soja") || fn.includes("farelo")) {
      detectedCategory = "feed";
      keywordHint = "soja";
      fallbackName = "Farelo de Soja";
      fallbackCost = 2.9;
    } else if (fn.includes("nucleo") || fn.includes("núcleo")) {
      detectedCategory = "feed";
      keywordHint = "núcleo";
      fallbackName = "Núcleo Postura 4%";
      fallbackCost = 6.8;
    } else if (fn.includes("milho")) {
      detectedCategory = "feed";
      keywordHint = "milho";
      fallbackName = "Milho em Grão";
      fallbackCost = 1.45;
    } else if (fn.includes("racao") || fn.includes("ração")) {
      detectedCategory = "feed";
      keywordHint = "ração";
      fallbackName = "Ração Postura";
      fallbackCost = 2.4;
    } else if (b > r + 14 || (g > r + 18 && b > 100)) {
      // Cool blue/cyan/green tones typical of veterinary medicine bottles & labels
      detectedCategory = "medicine";
      keywordHint = "vacina";
      fallbackName = "Vacina Newcastle + Bronquite";
      fallbackCost = 45.0;
    } else if (r > 150 && g > 115 && r - b > 42) {
      // Golden/yellow warm tones typical of corn & poultry feed
      detectedCategory = "feed";
      keywordHint = "milho";
      fallbackName = "Milho em Grão";
      fallbackCost = 1.45;
    } else if (r > 110 && g > 80 && b < 115 && r >= g && g >= b) {
      // Earthy brown/tan tones typical of soybean meal & ration sacks
      detectedCategory = "feed";
      keywordHint = "soja";
      fallbackName = "Farelo de Soja";
      fallbackCost = 2.9;
    } else if (std < 38) {
      detectedCategory = "supplies";
      keywordHint = "cartela";
      fallbackName = "Cartelas para 30 Ovos";
      fallbackCost = 0.95;
    } else if (std > 68) {
      detectedCategory = "equipment";
      keywordHint = "equipamento";
      fallbackName = "Comedouro / Bebedouro Avícola";
      fallbackCost = 38.0;
    }

    // 4. Resolve Physical State (liquid vs solid) & Size (small vs large)
    let state: "liquid" | "solid" | "discrete" = "solid";
    if (detectedState) {
      state = detectedState;
    } else if (hasLiquidWord) {
      state = "liquid";
    } else if (hasSolidWord) {
      state = "solid";
    } else if (detectedCategory === "medicine") {
      // Farm medicine/vaccines without solid indicators default to liquid flask/bottle
      state = "liquid";
    } else if (detectedCategory === "equipment") {
      state = "discrete";
    } else if (
      detectedCategory === "supplies" &&
      (fn.includes("desinfetante") ||
        fn.includes("detergente") ||
        fn.includes("cloro") ||
        fn.includes("sanitizante"))
    ) {
      state = "liquid";
    } else if (detectedCategory === "supplies") {
      state = "discrete";
    } else {
      state = "solid";
    }

    let size: "small" | "large" = "large";
    if (detectedSize) {
      size = detectedSize;
    } else if (hasSmallWord) {
      size = "small";
    } else if (hasLargeWord) {
      size = "large";
    } else if (state === "liquid") {
      if (
        detectedCategory === "medicine" ||
        fn.includes("frasco") ||
        fn.includes("gotas") ||
        fn.includes("ampola")
      ) {
        size = "small";
      } else if (
        fn.includes("bombona") ||
        fn.includes("balde") ||
        fn.includes("galao") ||
        fn.includes("galão") ||
        fn.includes("tambor")
      ) {
        size = "large";
      } else {
        size = "large";
      }
    } else if (state === "solid") {
      if (detectedCategory === "feed") {
        size = "large";
      } else if (detectedCategory === "medicine") {
        size = "small";
      } else {
        size = "large";
      }
    }

    // 5. Map to unit and quantity according to user rules:
    // - Líquido pequeno -> ml
    // - Líquido grande  -> L
    // - Sólido pequeno  -> g
    // - Sólido grande   -> kg
    let chosenUnit = explicitUnit;
    let chosenQty = detectedQty;

    if (!chosenUnit) {
      if (state === "liquid") {
        chosenUnit = size === "small" ? "ml" : "L";
      } else if (state === "solid") {
        chosenUnit = size === "small" ? "g" : "kg";
      } else {
        chosenUnit = "un";
      }
    }

    if (chosenQty === null || chosenQty <= 0) {
      if (chosenUnit === "ml") {
        chosenQty = 250;
      } else if (chosenUnit === "L") {
        chosenQty = 5;
      } else if (chosenUnit === "g") {
        chosenQty = 250;
      } else if (chosenUnit === "kg") {
        chosenQty = detectedCategory === "feed" ? 50 : 25;
      } else {
        chosenQty = detectedCategory === "supplies" ? 50 : 1;
      }
    }

    const stateDesc =
      state === "liquid"
        ? "líquido"
        : state === "solid"
          ? "sólido"
          : "unitário";
    const sizeDesc = size === "small" ? "pequeno" : "grande";

    // 6. Check if database already has a product matching this item/category
    // Only suggest a specific existing product from the database if there is a real keyword hint match!
    const dbSuggested = keywordHint
      ? products.find((p) => p.name.toLowerCase().includes(keywordHint))
      : undefined;

    const aiTip =
      "Dica: Para reconhecimento visual automático de qualquer objeto (contagem exata de garrafas, leitura de rótulos e pesos por IA), utilize uma chave gratuita do Google Gemini!";

    if (dbSuggested) {
      const presented = presentProduct(dbSuggested);
      let finalUnit = explicitUnit;
      if (!finalUnit) {
        if (state === "liquid") {
          finalUnit =
            presented.unit === "ml" || presented.unit === "L"
              ? presented.unit
              : chosenUnit;
        } else if (state === "solid") {
          finalUnit =
            presented.unit === "kg" ||
            presented.unit === "g" ||
            presented.unit === "saco"
              ? presented.unit
              : chosenUnit;
        } else {
          finalUnit = presented.unit || chosenUnit;
        }
      }
      const finalQty =
        detectedQty ??
        (finalUnit === presented.unit
          ? (presented.quantity ?? chosenQty)
          : chosenQty);

      res.json({
        matchedInDb: true,
        similarity: 85,
        matchedProduct: presented,
        suggestion: {
          name: presented.name,
          category: presented.category,
          unit: finalUnit,
          quantity: finalQty,
          minimumQuantity: 0, // Inicia em 0 conforme solicitado
          unitCost: presented.unitCost ?? fallbackCost,
          reason: `Produto ${stateDesc} (${sizeDesc}) identificado na categoria ${
            presented.category === "feed"
              ? "Alimentação"
              : presented.category === "medicine"
                ? "Remédios"
                : presented.category === "supplies"
                  ? "Insumos"
                  : presented.category === "equipment"
                    ? "Equipamentos"
                    : "Outros"
          }. Sugerindo “${presented.name}” do banco com unidade '${finalUnit}', quantidade ${finalQty} e estoque mínimo iniciado em 0.`,
        },
      });
      return;
    }

    res.json({
      matchedInDb: false,
      similarity: 0,
      matchedProduct: null,
      suggestion: {
        name: fallbackName,
        category: detectedCategory,
        unit: chosenUnit,
        quantity: chosenQty,
        minimumQuantity: 0, // Inicia em 0 conforme solicitado
        unitCost: fallbackCost,
        reason: `Item ${stateDesc} (${sizeDesc}) analisado. Unidade definida como '${chosenUnit}', quantidade sugerida: ${chosenQty} e estoque mínimo iniciado em 0. ${aiTip}`,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erro ao analisar imagem.",
    });
  }
});

supabaseRestRouter.patch("/inventory/products/:productId", async (req, res) => {
  const params = UpdateProductParams.safeParse(req.params);
  const body = UpdateProductBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }

  if (body.data.category !== undefined || body.data.unit !== undefined) {
    const used = await sbFetch<SbRecipeIngredientRow[]>(
      `farm_feed_recipe_ingredients?product_id=eq.${params.data.productId}&select=id&limit=1`,
    );
    if (
      used.length > 0 &&
      ((body.data.category !== undefined && body.data.category !== "feed") ||
        (body.data.unit !== undefined &&
          body.data.unit.toLowerCase() !== "kg"))
    ) {
      res.status(409).json({
        error:
          "Este ingrediente está em uma receita de ração e precisa continuar como Alimentação, em quilos.",
      });
      return;
    }
  }

  const patch: Record<string, unknown> = {};
  if (body.data.name !== undefined) patch.name = body.data.name.trim();
  if (body.data.category !== undefined) patch.category = body.data.category;
  if (body.data.unit !== undefined) patch.unit = body.data.unit.trim();
  if (body.data.minimumQuantity !== undefined) {
    patch.minimum_quantity = body.data.minimumQuantity ?? null;
  }
  if (body.data.unitCost !== undefined) {
    patch.unit_cost_cents =
      body.data.unitCost === null
        ? null
        : Math.round(body.data.unitCost * 100);
  }
  if (body.data.imageData !== undefined) {
    patch.image_data = body.data.imageData ?? null;
  }
  if (body.data.imageSignature !== undefined) {
    patch.image_signature = body.data.imageSignature ?? null;
  }

  const updated = await sbFetch<SbProductRow[]>(
    `farm_products?id=eq.${params.data.productId}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
  if (!updated.length) {
    res.status(404).json({ error: "Produto não encontrado." });
    return;
  }
  res.json(UpdateProductResponse.parse(presentProduct(updated[0])));
});

supabaseRestRouter.delete(
  "/inventory/products/:productId",
  async (req, res) => {
    const params = DeleteProductParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [moves, recipeIngs] = await Promise.all([
      sbFetch<{ id: number }[]>(
        `farm_stock_movements?product_id=eq.${params.data.productId}&select=id&limit=1`,
      ),
      sbFetch<{ id: number }[]>(
        `farm_feed_recipe_ingredients?product_id=eq.${params.data.productId}&select=id&limit=1`,
      ),
    ]);
    if (moves.length > 0) {
      res.status(409).json({
        error:
          "Este item tem histórico de estoque e não pode ser apagado. Edite o nome ou mantenha o cadastro.",
      });
      return;
    }
    if (recipeIngs.length > 0) {
      res.status(409).json({
        error:
          "Este item faz parte de uma receita de ração. Remova-o da receita antes de excluir o cadastro.",
      });
      return;
    }

    const deleted = await sbFetch<SbProductRow[]>(
      `farm_products?id=eq.${params.data.productId}`,
      { method: "DELETE" },
    );
    if (!deleted || deleted.length === 0) {
      res.status(404).json({ error: "Produto não encontrado." });
      return;
    }
    res.status(204).json(DeleteProductResponse.parse(undefined));
  },
);

supabaseRestRouter.get("/inventory/movements", async (_req, res) => {
  const [movements, products] = await Promise.all([
    sbFetch<SbMovementRow[]>(
      "farm_stock_movements?select=*&order=created_at.desc",
    ),
    sbFetch<SbProductRow[]>("farm_products?select=id,name"),
  ]);
  const productNames = new Map(products.map((p) => [p.id, p.name]));

  res.json(
    GetMovementsResponse.parse(
      movements.map((m) => ({
        id: m.id,
        productId: m.product_id,
        productName: productNames.get(m.product_id) ?? `Produto #${m.product_id}`,
        direction: m.direction,
        quantity: Number(m.quantity),
        note: m.note,
        createdAt: toIsoTimestamp(m.created_at),
      })),
    ),
  );
});

supabaseRestRouter.post("/inventory/movements", async (req, res) => {
  const parsed = CreateMovementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const products = await sbFetch<SbProductRow[]>(
    `farm_products?id=eq.${parsed.data.productId}&select=*&limit=1`,
  );
  const product = products[0];
  if (!product) {
    res.status(404).json({ error: "Produto não encontrado." });
    return;
  }

  if (
    parsed.data.direction === "out" &&
    Number(product.quantity) < parsed.data.quantity
  ) {
    res
      .status(400)
      .json({ error: "Não há estoque suficiente para essa saída." });
    return;
  }

  const nextQuantity =
    parsed.data.direction === "in"
      ? roundKg(Number(product.quantity) + parsed.data.quantity)
      : roundKg(Number(product.quantity) - parsed.data.quantity);

  await sbFetch(`farm_products?id=eq.${product.id}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity: nextQuantity }),
  });

  const [movement] = await sbFetch<SbMovementRow[]>("farm_stock_movements", {
    method: "POST",
    body: JSON.stringify({
      product_id: product.id,
      direction: parsed.data.direction,
      quantity: parsed.data.quantity,
      note: parsed.data.note ?? null,
    }),
  });

  res.status(201).json(
    CreateMovementResponse.parse({
      id: movement.id,
      productId: movement.product_id,
      productName: product.name,
      direction: movement.direction,
      quantity: Number(movement.quantity),
      note: movement.note,
      createdAt: toIsoTimestamp(movement.created_at),
    }),
  );
});

supabaseRestRouter.delete(
  "/inventory/movements/:movementId",
  async (req, res) => {
    const params = DeleteMovementParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const moves = await sbFetch<SbMovementRow[]>(
      `farm_stock_movements?id=eq.${params.data.movementId}&select=*&limit=1`,
    );
    const movement = moves[0];
    if (!movement) {
      res.status(404).json({ error: "Movimentação não encontrada." });
      return;
    }
    if (movement.source_type === "feeding") {
      res.status(400).json({
        error:
          "Este movimento pertence a um registro de alimentação. Exclua o registro pela página de alimentação para restaurar o estoque.",
      });
      return;
    }

    const products = await sbFetch<SbProductRow[]>(
      `farm_products?id=eq.${movement.product_id}&select=*&limit=1`,
    );
    const product = products[0];
    if (!product) {
      res.status(404).json({ error: "Produto não encontrado." });
      return;
    }

    const nextQuantity =
      movement.direction === "in"
        ? roundKg(Number(product.quantity) - Number(movement.quantity))
        : roundKg(Number(product.quantity) + Number(movement.quantity));
    if (nextQuantity < 0) {
      res.status(400).json({
        error:
          "Não é possível desfazer esta entrada porque o estoque atual ficaria negativo.",
      });
      return;
    }

    await sbFetch(`farm_products?id=eq.${product.id}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity: nextQuantity }),
    });
    await sbFetch(`farm_stock_movements?id=eq.${movement.id}`, {
      method: "DELETE",
    });

    res.status(204).json(DeleteMovementResponse.parse(undefined));
  },
);

supabaseRestRouter.get("/finance/entries", async (_req, res) => {
  const entries = await sbFetch<SbFinanceRow[]>(
    "farm_finance_entries?select=*&order=due_date.asc,created_at.desc",
  );
  res.json(GetFinanceEntriesResponse.parse(entries.map(presentFinance)));
});

supabaseRestRouter.post("/finance/entries", async (req, res) => {
  const parsed = CreateFinanceEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [entry] = await sbFetch<SbFinanceRow[]>("farm_finance_entries", {
    method: "POST",
    body: JSON.stringify({
      kind: parsed.data.kind,
      description: parsed.data.description.trim(),
      amount_cents: Math.round(parsed.data.amount * 100),
      due_date: dateForDatabase(parsed.data.dueDate),
      category: parsed.data.category?.trim() || null,
    }),
  });
  res.status(201).json(CreateFinanceEntryResponse.parse(presentFinance(entry)));
});

supabaseRestRouter.patch("/finance/entries/:entryId", async (req, res) => {
  const params = UpdateFinanceEntryParams.safeParse(req.params);
  const body = UpdateFinanceEntryBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }

  const patch: Record<string, unknown> = {};
  if (body.data.description !== undefined) {
    patch.description = body.data.description.trim();
  }
  if (body.data.amount !== undefined) {
    patch.amount_cents = Math.round(body.data.amount * 100);
  }
  if (body.data.dueDate !== undefined) {
    patch.due_date = dateForDatabase(body.data.dueDate);
  }
  if (body.data.category !== undefined) {
    patch.category = body.data.category.trim() || null;
  }
  if (body.data.status !== undefined) {
    patch.status = body.data.status;
    patch.settled_at =
      body.data.status === "settled" ? new Date().toISOString() : null;
  }

  const updated = await sbFetch<SbFinanceRow[]>(
    `farm_finance_entries?id=eq.${params.data.entryId}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
  if (!updated.length) {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }
  res.json(UpdateFinanceEntryResponse.parse(presentFinance(updated[0])));
});

supabaseRestRouter.delete("/finance/entries/:entryId", async (req, res) => {
  const params = DeleteFinanceEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const deleted = await sbFetch<SbFinanceRow[]>(
    `farm_finance_entries?id=eq.${params.data.entryId}`,
    { method: "DELETE" },
  );
  if (!deleted || deleted.length === 0) {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }
  res.status(204).json(DeleteFinanceEntryResponse.parse(undefined));
});

supabaseRestRouter.get("/poultry/summary", async (_req, res) => {
  const lots = await sbFetch<SbPoultryLotRow[]>(
    "farm_poultry_lots?select=current_count",
  );
  res.json(
    GetPoultrySummaryResponse.parse({
      activeLotCount: lots.filter((l) => l.current_count > 0).length,
      liveBirdCount: lots.reduce((s, l) => s + Number(l.current_count), 0),
    }),
  );
});

supabaseRestRouter.get("/poultry/lots", async (_req, res) => {
  const lots = await sbFetch<SbPoultryLotRow[]>(
    "farm_poultry_lots?select=*&order=received_at.desc,id.desc",
  );
  res.json(GetPoultryLotsResponse.parse(lots.map(presentLot)));
});

supabaseRestRouter.post("/poultry/lots", async (req, res) => {
  const parsed = CreatePoultryLotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const receivedAt = dateForDatabase(parsed.data.receivedAt);
  const [lot] = await sbFetch<SbPoultryLotRow[]>("farm_poultry_lots", {
    method: "POST",
    body: JSON.stringify({
      label: parsed.data.label.trim(),
      kind: parsed.data.kind,
      received_at: receivedAt,
      source: parsed.data.source?.trim() || null,
      breed: parsed.data.breed?.trim() || null,
      age_weeks: parsed.data.ageWeeks ?? null,
      initial_count: parsed.data.initialCount,
      current_count: parsed.data.initialCount,
    }),
  });
  await sbFetch("farm_poultry_movements", {
    method: "POST",
    body: JSON.stringify({
      lot_id: lot.id,
      direction: "in",
      quantity: parsed.data.initialCount,
      movement_date: receivedAt,
      counterparty: parsed.data.source?.trim() || null,
      reason: null,
    }),
  });
  res.status(201).json(CreatePoultryLotResponse.parse(presentLot(lot)));
});

supabaseRestRouter.patch("/poultry/lots/:lotId", async (req, res) => {
  const params = UpdatePoultryLotParams.safeParse(req.params);
  const body = UpdatePoultryLotBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const patch: Record<string, unknown> = {};
  if (body.data.label !== undefined) patch.label = body.data.label.trim();
  if (body.data.source !== undefined) {
    patch.source = body.data.source?.trim() || null;
  }
  if (body.data.breed !== undefined) {
    patch.breed = body.data.breed?.trim() || null;
  }
  if (body.data.ageWeeks !== undefined) {
    patch.age_weeks = body.data.ageWeeks ?? null;
  }

  const updated = await sbFetch<SbPoultryLotRow[]>(
    `farm_poultry_lots?id=eq.${params.data.lotId}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
  if (!updated.length) {
    res.status(404).json({ error: "Lote não encontrado." });
    return;
  }
  res.json(UpdatePoultryLotResponse.parse(presentLot(updated[0])));
});

supabaseRestRouter.post(
  "/poultry/lots/:lotId/dispatches",
  async (req, res) => {
    const params = CreatePoultryDispatchParams.safeParse(req.params);
    const body = CreatePoultryDispatchBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Dados inválidos." });
      return;
    }

    const lots = await sbFetch<SbPoultryLotRow[]>(
      `farm_poultry_lots?id=eq.${params.data.lotId}&select=*&limit=1`,
    );
    const lot = lots[0];
    if (!lot) {
      res.status(404).json({ error: "Lote não encontrado." });
      return;
    }
    if (body.data.quantity > lot.current_count) {
      res.status(400).json({
        error:
          "A quantidade de saída não pode ser maior que as aves disponíveis no lote.",
      });
      return;
    }

    const [movement] = await sbFetch<SbPoultryMovementRow[]>(
      "farm_poultry_movements",
      {
        method: "POST",
        body: JSON.stringify({
          lot_id: lot.id,
          direction: "out",
          quantity: body.data.quantity,
          movement_date: dateForDatabase(body.data.movementDate),
          counterparty: body.data.counterparty?.trim() || null,
          reason: body.data.reason,
        }),
      },
    );

    await sbFetch(`farm_poultry_lots?id=eq.${lot.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        current_count: lot.current_count - body.data.quantity,
      }),
    });

    res
      .status(201)
      .json(
        CreatePoultryDispatchResponse.parse(
          presentPoultryMovement(movement, lot.label),
        ),
      );
  },
);

supabaseRestRouter.get("/poultry/movements", async (_req, res) => {
  const [movements, lots] = await Promise.all([
    sbFetch<SbPoultryMovementRow[]>(
      "farm_poultry_movements?select=*&order=movement_date.desc,id.desc",
    ),
    sbFetch<SbPoultryLotRow[]>("farm_poultry_lots?select=id,label"),
  ]);
  const lotLabels = new Map(lots.map((l) => [l.id, l.label]));
  res.json(
    GetPoultryMovementsResponse.parse(
      movements.map((m) =>
        presentPoultryMovement(m, lotLabels.get(m.lot_id) ?? `Lote #${m.lot_id}`),
      ),
    ),
  );
});

supabaseRestRouter.delete(
  "/poultry/movements/:movementId",
  async (req, res) => {
    const params = DeletePoultryMovementParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const moves = await sbFetch<SbPoultryMovementRow[]>(
      `farm_poultry_movements?id=eq.${params.data.movementId}&select=*&limit=1`,
    );
    const movement = moves[0];
    if (!movement) {
      res.status(404).json({ error: "Movimentação não encontrada." });
      return;
    }
    if (movement.direction === "in") {
      res.status(400).json({
        error:
          "A chegada inicial não pode ser excluída. Edite os dados do lote ou registre uma saída para corrigir a quantidade.",
      });
      return;
    }
    const lots = await sbFetch<SbPoultryLotRow[]>(
      `farm_poultry_lots?id=eq.${movement.lot_id}&select=*&limit=1`,
    );
    const lot = lots[0];
    if (lot) {
      await sbFetch(`farm_poultry_lots?id=eq.${lot.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          current_count: lot.current_count + movement.quantity,
        }),
      });
    }
    await sbFetch(`farm_poultry_movements?id=eq.${movement.id}`, {
      method: "DELETE",
    });
    res.status(204).json(DeletePoultryMovementResponse.parse(undefined));
  },
);

supabaseRestRouter.get("/feeding/summary", async (_req, res) => {
  const logs = await sbFetch<SbFeedingLogRow[]>("farm_feeding_logs?select=*");
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  const todayLogs = logs.filter((l) => l.feeding_date === today);
  const monthLogs = logs.filter(
    (l) => l.feeding_date >= monthStart && l.feeding_date <= today,
  );
  const sumCost = (items: SbFeedingLogRow[]) =>
    items.some((i) => i.total_cost_cents === null)
      ? null
      : items.reduce((s, i) => s + Number(i.total_cost_cents ?? 0), 0) / 100;

  res.json(
    GetFeedingSummaryResponse.parse({
      todayQuantityKg: todayLogs.reduce(
        (s, l) => s + Number(l.quantity_kg),
        0,
      ),
      todayCost: sumCost(todayLogs),
      monthCost: sumCost(monthLogs),
      logsToday: todayLogs.length,
    }),
  );
});

supabaseRestRouter.get("/feeding/recipes", async (_req, res) => {
  res.json(GetFeedRecipesResponse.parse(await loadRecipesFromSupabase()));
});

supabaseRestRouter.post("/feeding/recipes", async (req, res) => {
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
  const products = await sbFetch<SbProductRow[]>("farm_products?select=*");
  const valid = body.data.ingredients.every((ing) => {
    const p = products.find((x) => x.id === ing.productId);
    return p && p.category === "feed" && p.unit.toLowerCase() === "kg";
  });
  if (!valid) {
    res.status(400).json({
      error: "Use ingredientes cadastrados como Alimentação, medidos em quilos.",
    });
    return;
  }

  const [recipe] = await sbFetch<SbRecipeRow[]>("farm_feed_recipes", {
    method: "POST",
    body: JSON.stringify({ name: body.data.name.trim() }),
  });

  await sbFetch("farm_feed_recipe_ingredients", {
    method: "POST",
    body: JSON.stringify(
      body.data.ingredients.map((ing) => ({
        recipe_id: recipe.id,
        product_id: ing.productId,
        quantity_kg: ing.quantityKg,
      })),
    ),
  });

  const all = await loadRecipesFromSupabase();
  const created = all.find((r) => r.id === recipe.id);
  res.status(201).json(CreateFeedRecipeResponse.parse(created));
});

supabaseRestRouter.patch("/feeding/recipes/:recipeId", async (req, res) => {
  const params = UpdateFeedRecipeParams.safeParse(req.params);
  const body = UpdateFeedRecipeBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  const uniqueIds = new Set(body.data.ingredients.map((i) => i.productId));
  if (uniqueIds.size !== body.data.ingredients.length) {
    res.status(400).json({
      error: "Cada ingrediente deve aparecer uma única vez na receita.",
    });
    return;
  }
  const products = await sbFetch<SbProductRow[]>("farm_products?select=*");
  const valid = body.data.ingredients.every((ing) => {
    const p = products.find((x) => x.id === ing.productId);
    return p && p.category === "feed" && p.unit.toLowerCase() === "kg";
  });
  if (!valid) {
    res.status(400).json({
      error: "Use ingredientes cadastrados como Alimentação, medidos em quilos.",
    });
    return;
  }

  const updated = await sbFetch<SbRecipeRow[]>(
    `farm_feed_recipes?id=eq.${params.data.recipeId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ name: body.data.name.trim() }),
    },
  );
  if (!updated.length) {
    res.status(404).json({ error: "Receita não encontrada." });
    return;
  }

  await sbFetch(
    `farm_feed_recipe_ingredients?recipe_id=eq.${params.data.recipeId}`,
    { method: "DELETE" },
  );
  await sbFetch("farm_feed_recipe_ingredients", {
    method: "POST",
    body: JSON.stringify(
      body.data.ingredients.map((ing) => ({
        recipe_id: params.data.recipeId,
        product_id: ing.productId,
        quantity_kg: ing.quantityKg,
      })),
    ),
  });

  const all = await loadRecipesFromSupabase();
  const result = all.find((r) => r.id === params.data.recipeId);
  res.json(UpdateFeedRecipeResponse.parse(result));
});

supabaseRestRouter.delete("/feeding/recipes/:recipeId", async (req, res) => {
  const params = DeleteFeedRecipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const used = await sbFetch<{ id: number }[]>(
    `farm_feeding_logs?recipe_id=eq.${params.data.recipeId}&select=id&limit=1`,
  );
  if (used.length > 0) {
    res.status(409).json({
      error:
        "Esta receita já foi usada. Mantenha o histórico e crie outra receita se necessário.",
    });
    return;
  }
  const deleted = await sbFetch<SbRecipeRow[]>(
    `farm_feed_recipes?id=eq.${params.data.recipeId}`,
    { method: "DELETE" },
  );
  if (!deleted || deleted.length === 0) {
    res.status(404).json({ error: "Receita não encontrada." });
    return;
  }
  res.status(204).json(DeleteFeedRecipeResponse.parse(undefined));
});

supabaseRestRouter.get("/feeding/logs", async (_req, res) => {
  const logs = await sbFetch<SbFeedingLogRow[]>(
    "farm_feeding_logs?select=*&order=feeding_date.desc,id.desc",
  );
  res.json(GetFeedLogsResponse.parse(logs.map(presentFeedLog)));
});

supabaseRestRouter.post("/feeding/logs", async (req, res) => {
  const body = CreateFeedLogBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [lots, recipes, ingredients, products] = await Promise.all([
    sbFetch<SbPoultryLotRow[]>(
      `farm_poultry_lots?id=eq.${body.data.lotId}&select=*&limit=1`,
    ),
    sbFetch<SbRecipeRow[]>(
      `farm_feed_recipes?id=eq.${body.data.recipeId}&select=*&limit=1`,
    ),
    sbFetch<SbRecipeIngredientRow[]>(
      `farm_feed_recipe_ingredients?recipe_id=eq.${body.data.recipeId}&select=*`,
    ),
    sbFetch<SbProductRow[]>("farm_products?select=*"),
  ]);

  const lot = lots[0];
  if (!lot) {
    res.status(404).json({ error: "Lote de aves não encontrado." });
    return;
  }
  if (lot.current_count === 0) {
    res.status(400).json({
      error: "Não é possível registrar alimentação para um lote sem aves.",
    });
    return;
  }
  const recipe = recipes[0];
  if (!recipe) {
    res.status(404).json({ error: "Receita de ração não encontrada." });
    return;
  }
  const batchWeightKg = ingredients.reduce(
    (s, i) => s + Number(i.quantity_kg),
    0,
  );
  if (batchWeightKg <= 0) {
    res
      .status(400)
      .json({ error: "A receita não possui ingredientes válidos." });
    return;
  }

  const allocations: Array<{ product: SbProductRow; quantityUsed: number }> = [];
  for (const ing of ingredients) {
    const product = products.find((p) => p.id === ing.product_id);
    if (!product) {
      res.status(400).json({ error: "Ingrediente inválido." });
      return;
    }
    const quantityUsed = roundKg(
      (body.data.quantityKg * Number(ing.quantity_kg)) / batchWeightKg,
    );
    if (Number(product.quantity) + 0.0000001 < quantityUsed) {
      res.status(400).json({
        error: `Estoque insuficiente de ${product.name} para essa alimentação.`,
      });
      return;
    }
    allocations.push({ product, quantityUsed });
  }

  const totalCostCents = allocations.some(
    ({ product }) => product.unit_cost_cents === null,
  )
    ? null
    : allocations.reduce(
        (sum, { product, quantityUsed }) =>
          sum + Math.round(quantityUsed * Number(product.unit_cost_cents ?? 0)),
        0,
      );

  const [log] = await sbFetch<SbFeedingLogRow[]>("farm_feeding_logs", {
    method: "POST",
    body: JSON.stringify({
      lot_id: lot.id,
      recipe_id: recipe.id,
      lot_label_snapshot: lot.label,
      recipe_name_snapshot: recipe.name,
      quantity_kg: body.data.quantityKg,
      total_cost_cents: totalCostCents,
      feeding_date: dateForDatabase(body.data.feedingDate),
    }),
  });

  for (const { product, quantityUsed } of allocations) {
    const nextQty = roundKg(Number(product.quantity) - quantityUsed);
    await sbFetch(`farm_products?id=eq.${product.id}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity: nextQty }),
    });
    await sbFetch("farm_stock_movements", {
      method: "POST",
      body: JSON.stringify({
        product_id: product.id,
        direction: "out",
        quantity: quantityUsed,
        note: `Alimentação · ${recipe.name} · ${lot.label}`,
        source_type: "feeding",
        source_id: log.id,
      }),
    });
  }

  res.status(201).json(CreateFeedLogResponse.parse(presentFeedLog(log)));
});

supabaseRestRouter.delete("/feeding/logs/:logId", async (req, res) => {
  const params = DeleteFeedLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const logs = await sbFetch<SbFeedingLogRow[]>(
    `farm_feeding_logs?id=eq.${params.data.logId}&select=*&limit=1`,
  );
  const log = logs[0];
  if (!log) {
    res.status(404).json({ error: "Registro de alimentação não encontrado." });
    return;
  }

  const moves = await sbFetch<SbMovementRow[]>(
    `farm_stock_movements?source_type=eq.feeding&source_id=eq.${log.id}&select=*`,
  );
  for (const move of moves) {
    const prods = await sbFetch<SbProductRow[]>(
      `farm_products?id=eq.${move.product_id}&select=*&limit=1`,
    );
    if (prods[0]) {
      await sbFetch(`farm_products?id=eq.${prods[0].id}`, {
        method: "PATCH",
        body: JSON.stringify({
          quantity: roundKg(
            Number(prods[0].quantity) + Number(move.quantity),
          ),
        }),
      });
    }
  }
  await sbFetch(
    `farm_stock_movements?source_type=eq.feeding&source_id=eq.${log.id}`,
    { method: "DELETE" },
  );
  await sbFetch(`farm_feeding_logs?id=eq.${log.id}`, { method: "DELETE" });

  res.status(204).json(DeleteFeedLogResponse.parse(undefined));
});
