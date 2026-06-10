import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === "test") {
    const testUserId = req.headers["x-test-user-id"];
    if (testUserId && typeof testUserId === "string") {
      req.userId = testUserId;
      next();
      return;
    }
  }
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
}
