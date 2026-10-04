import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  poultryLotsTable,
  poultryMovementsTable,
} from "@workspace/db";
import {
  CreatePoultryDispatchBody,
  CreatePoultryDispatchParams,
  CreatePoultryDispatchResponse,
  CreatePoultryLotBody,
  CreatePoultryLotResponse,
  DeletePoultryMovementParams,
  DeletePoultryMovementResponse,
  GetPoultryLotsResponse,
  GetPoultryMovementsResponse,
  GetPoultrySummaryResponse,
  UpdatePoultryLotBody,
  UpdatePoultryLotParams,
  UpdatePoultryLotResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function dateForDatabase(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function presentLot(lot: typeof poultryLotsTable.$inferSelect) {
  return { ...lot, createdAt: lot.createdAt.toISOString() };
}

function presentMovement(
  movement: typeof poultryMovementsTable.$inferSelect,
  lotLabel: string,
) {
  return {
    ...movement,
    lotLabel,
    createdAt: movement.createdAt.toISOString(),
  };
}

router.get("/poultry/summary", async (_req, res): Promise<void> => {
  const lots = await db.select().from(poultryLotsTable);
  res.json(
    GetPoultrySummaryResponse.parse({
      activeLotCount: lots.filter((lot) => lot.currentCount > 0).length,
      liveBirdCount: lots.reduce((total, lot) => total + lot.currentCount, 0),
    }),
  );
});

router.get("/poultry/lots", async (_req, res): Promise<void> => {
  const lots = await db
    .select()
    .from(poultryLotsTable)
    .orderBy(desc(poultryLotsTable.receivedAt), desc(poultryLotsTable.id));
  res.json(GetPoultryLotsResponse.parse(lots.map(presentLot)));
});

router.post("/poultry/lots", async (req, res): Promise<void> => {
  const parsed = CreatePoultryLotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await db.transaction(async (tx) => {
    const receivedAt = dateForDatabase(parsed.data.receivedAt);
    const [lot] = await tx
      .insert(poultryLotsTable)
      .values({
        label: parsed.data.label.trim(),
        kind: parsed.data.kind,
        receivedAt,
        source: parsed.data.source?.trim() || null,
        breed: parsed.data.breed?.trim() || null,
        ageWeeks: parsed.data.ageWeeks ?? null,
        initialCount: parsed.data.initialCount,
        currentCount: parsed.data.initialCount,
      })
      .returning();
    await tx.insert(poultryMovementsTable).values({
      lotId: lot.id,
      direction: "in",
      quantity: parsed.data.initialCount,
      movementDate: receivedAt,
      counterparty: parsed.data.source?.trim() || null,
      reason: null,
    });
    return lot;
  });
  res.status(201).json(CreatePoultryLotResponse.parse(presentLot(result)));
});

router.patch("/poultry/lots/:lotId", async (req, res): Promise<void> => {
  const params = UpdatePoultryLotParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdatePoultryLotBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const changes: Partial<typeof poultryLotsTable.$inferInsert> = {};
  if (body.data.label !== undefined) changes.label = body.data.label.trim();
  if (body.data.source !== undefined) {
    changes.source = body.data.source?.trim() || null;
  }
  if (body.data.breed !== undefined) {
    changes.breed = body.data.breed?.trim() || null;
  }
  if (body.data.ageWeeks !== undefined) {
    changes.ageWeeks = body.data.ageWeeks ?? null;
  }
  const [lot] = await db
    .update(poultryLotsTable)
    .set(changes)
    .where(eq(poultryLotsTable.id, params.data.lotId))
    .returning();
  if (!lot) {
    res.status(404).json({ error: "Lote não encontrado." });
    return;
  }
  res.json(UpdatePoultryLotResponse.parse(presentLot(lot)));
});

router.post(
  "/poultry/lots/:lotId/dispatches",
  async (req, res): Promise<void> => {
    const params = CreatePoultryDispatchParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = CreatePoultryDispatchBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [lot] = await tx
        .select()
        .from(poultryLotsTable)
        .where(eq(poultryLotsTable.id, params.data.lotId))
        .for("update");
      if (!lot) return { error: "not_found" as const };
      if (body.data.quantity > lot.currentCount) {
        return { error: "insufficient_birds" as const };
      }
      const [movement] = await tx
        .insert(poultryMovementsTable)
        .values({
          lotId: lot.id,
          direction: "out",
          quantity: body.data.quantity,
          movementDate: dateForDatabase(body.data.movementDate),
          counterparty: body.data.counterparty?.trim() || null,
          reason: body.data.reason,
        })
        .returning();
      await tx
        .update(poultryLotsTable)
        .set({ currentCount: lot.currentCount - body.data.quantity })
        .where(eq(poultryLotsTable.id, lot.id));
      return { movement, lotLabel: lot.label };
    });

    if ("error" in result) {
      if (result.error === "not_found") {
        res.status(404).json({ error: "Lote não encontrado." });
        return;
      }
      res.status(400).json({
        error: "A quantidade de saída não pode ser maior que as aves disponíveis no lote.",
      });
      return;
    }
    res
      .status(201)
      .json(
        CreatePoultryDispatchResponse.parse(
          presentMovement(result.movement, result.lotLabel),
        ),
      );
  },
);

router.get("/poultry/movements", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      movement: poultryMovementsTable,
      lotLabel: poultryLotsTable.label,
    })
    .from(poultryMovementsTable)
    .innerJoin(
      poultryLotsTable,
      eq(poultryMovementsTable.lotId, poultryLotsTable.id),
    )
    .orderBy(
      desc(poultryMovementsTable.movementDate),
      desc(poultryMovementsTable.id),
    );
  res.json(
    GetPoultryMovementsResponse.parse(
      rows.map(({ movement, lotLabel }) => presentMovement(movement, lotLabel)),
    ),
  );
});

router.delete(
  "/poultry/movements/:movementId",
  async (req, res): Promise<void> => {
    const params = DeletePoultryMovementParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [movement] = await tx
        .select()
        .from(poultryMovementsTable)
        .where(eq(poultryMovementsTable.id, params.data.movementId))
        .for("update");
      if (!movement) return { error: "not_found" as const };
      if (movement.direction === "in") {
        return { error: "initial_arrival" as const };
      }
      const [lot] = await tx
        .select()
        .from(poultryLotsTable)
        .where(eq(poultryLotsTable.id, movement.lotId))
        .for("update");
      if (!lot) return { error: "not_found" as const };
      await tx
        .update(poultryLotsTable)
        .set({ currentCount: lot.currentCount + movement.quantity })
        .where(eq(poultryLotsTable.id, lot.id));
      await tx
        .delete(poultryMovementsTable)
        .where(eq(poultryMovementsTable.id, movement.id));
      return { deleted: true as const };
    });

    if ("error" in result) {
      if (result.error === "not_found") {
        res.status(404).json({ error: "Movimentação não encontrada." });
        return;
      }
      res.status(400).json({
        error:
          "A chegada inicial não pode ser excluída. Edite os dados do lote ou registre uma saída para corrigir a quantidade.",
      });
      return;
    }
    res.status(204).json(DeletePoultryMovementResponse.parse(undefined));
  },
);

export default router;