import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
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
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const DEFAULT_PREFS: UserPrefsPayload = {
  minimapVisible: true,
  tagsVisible: true,
};

function validateUserId(req: Request, res: Response, next: NextFunction): void {
  const params = GetUserPreferencesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }
  next();
}

function validateUserIdForPut(req: Request, res: Response, next: NextFunction): void {
  const params = SetUserPreferencesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }
  next();
}

router.get("/preferences/:userId", validateUserId, requireAuth, async (req, res) => {
  const userId = req.userId!;

  if (req.params.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const rows = await db
    .select()
    .from(userPreferencesTable)
    .where(eq(userPreferencesTable.userId, userId))
    .limit(1);

  const prefs = rows[0]?.preferences ?? DEFAULT_PREFS;
  const result = GetUserPreferencesResponse.parse(prefs);
  res.json(result);
});

router.put("/preferences/:userId", validateUserIdForPut, requireAuth, async (req, res) => {
  const userId = req.userId!;

  if (req.params.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const body = SetUserPreferencesBody.safeParse(req.body);
  if (!body.success) {
    const unknownFields = (
      body.error.issues as Array<{ code: string; keys?: string[] }>
    )
      .filter((i) => i.code === "unrecognized_keys")
      .flatMap((i) => i.keys ?? []);

    const message =
      unknownFields.length > 0
        ? `Unrecognised fields: [${unknownFields.join(", ")}]`
        : "Invalid preferences payload";

    res.status(400).json({
      message,
      validation: body.error.flatten(),
    });
    return;
  }

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
