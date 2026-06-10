import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";
import type { Request, Response, NextFunction } from "express";

vi.mock("@workspace/db", () => {
  const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  const mockLimit = vi.fn().mockResolvedValue([]);
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  return {
    db: { insert: mockInsert, select: mockSelect },
    userPreferencesTable: { userId: "userId" },
  };
});

vi.mock("../middlewares/requireAuth", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.userId = "test-user";
    next();
  },
}));

const { default: preferencesRouter } = await import("./preferences");

const app = express();
app.use(express.json());
app.use(preferencesRouter);

const USER_ID = "test-user";

describe("PUT /preferences/:userId", () => {
  it("returns 200 for a valid payload", async () => {
    const res = await request(app)
      .put(`/preferences/${USER_ID}`)
      .send({ minimapVisible: true, tagsVisible: false });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ minimapVisible: true, tagsVisible: false });
  });

  it("returns 400 when the payload contains an unknown field", async () => {
    const res = await request(app)
      .put(`/preferences/${USER_ID}`)
      .send({ minimapVisible: true, tagsVisible: false, unknownField: "bad" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when a required field is missing", async () => {
    const res = await request(app)
      .put(`/preferences/${USER_ID}`)
      .send({ minimapVisible: true });

    expect(res.status).toBe(400);
  });

  it("returns 400 when a field has the wrong type", async () => {
    const res = await request(app)
      .put(`/preferences/${USER_ID}`)
      .send({ minimapVisible: "yes", tagsVisible: false });

    expect(res.status).toBe(400);
  });

  it("returns 403 when userId does not match the authenticated user", async () => {
    const res = await request(app)
      .put("/preferences/other-user")
      .send({ minimapVisible: true, tagsVisible: false });

    expect(res.status).toBe(403);
  });
});

describe("GET /preferences/:userId", () => {
  it("returns 200 with default prefs when no record exists", async () => {
    const res = await request(app).get(`/preferences/${USER_ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ minimapVisible: true, tagsVisible: true });
  });

  it("returns 403 when userId does not match the authenticated user", async () => {
    const res = await request(app).get("/preferences/other-user");

    expect(res.status).toBe(403);
  });
});
