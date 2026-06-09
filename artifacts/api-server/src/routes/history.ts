import { Router, type IRouter } from "express";
import {
  GetSimulationHistoryResponse,
  GetSimulationHistoryResponseItem,
  SaveSimulationRunBody,
} from "@workspace/api-zod";
import { db, simulationRunsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/history", requireAuth, async (req, res) => {
  const userId = req.userId!;

  const rows = await db
    .select()
    .from(simulationRunsTable)
    .where(eq(simulationRunsTable.userId, userId))
    .orderBy(desc(simulationRunsTable.runAt))
    .limit(100);

  const result = GetSimulationHistoryResponse.parse(
    rows.map((r) => ({
      id: r.id,
      scenario: r.scenario,
      seed: r.seed ?? null,
      outcome: r.outcome ?? null,
      score: r.score ?? null,
      durationSeconds: r.durationSeconds ?? null,
      scoreData: r.scoreData ?? null,
      runAt: r.runAt,
    })),
  );
  res.json(result);
});

router.post("/history", requireAuth, async (req, res) => {
  const userId = req.userId!;

  const body = SaveSimulationRunBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid payload", details: body.error.flatten() });
    return;
  }

  const { scenario, seed, outcome, score, durationSeconds, scoreData } = body.data;

  const [inserted] = await db
    .insert(simulationRunsTable)
    .values({
      userId,
      scenario,
      seed: seed ?? null,
      outcome: outcome ?? null,
      score: score ?? null,
      durationSeconds: durationSeconds ?? null,
      scoreData: scoreData ?? null,
      runAt: new Date(),
    })
    .returning();

  const result = GetSimulationHistoryResponseItem.parse({
    id: inserted.id,
    scenario: inserted.scenario,
    seed: inserted.seed ?? null,
    outcome: inserted.outcome ?? null,
    score: inserted.score ?? null,
    durationSeconds: inserted.durationSeconds ?? null,
    scoreData: inserted.scoreData ?? null,
    runAt: inserted.runAt,
  });
  res.status(201).json(result);
});

export default router;
