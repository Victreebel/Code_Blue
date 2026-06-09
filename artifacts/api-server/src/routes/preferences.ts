import { Router, type IRouter } from "express";
import {
  GetUserPreferencesParams,
  GetUserPreferencesResponse,
  SetUserPreferencesBody,
  SetUserPreferencesParams,
  SetUserPreferencesResponse,
} from "@workspace/api-zod";
import { db, userPreferencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { UserPrefsPayload } from "@workspace/db";

const router: IRouter = Router();

const DEFAULT_PREFS: UserPrefsPayload = {
  minimapVisible: true,
  tagsVisible: true,
};

router.get("/preferences/:userId", async (req, res) => {
  const params = GetUserPreferencesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const { userId } = params.data;

  const rows = await db
    .select()
    .from(userPreferencesTable)
    .where(eq(userPreferencesTable.userId, userId))
    .limit(1);

  const prefs = rows[0]?.preferences ?? DEFAULT_PREFS;
  const result = GetUserPreferencesResponse.parse(prefs);
  res.json(result);
});

router.put("/preferences/:userId", async (req, res) => {
  const params = SetUserPreferencesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const body = SetUserPreferencesBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid preferences payload", details: body.error.flatten() });
    return;
  }

  const { userId } = params.data;
  const preferences: UserPrefsPayload = body.data;

  await db
    .insert(userPreferencesTable)
    .values({ userId, preferences, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userPreferencesTable.userId,
      set: { preferences, updatedAt: new Date() },
    });

  const result = SetUserPreferencesResponse.parse(preferences);
  res.json(result);
});

export default router;
