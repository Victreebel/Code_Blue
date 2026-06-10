/**
 * Integration tests for userId validation rules on the preferences endpoints.
 *
 * The validation middleware runs BEFORE requireAuth, so:
 *   - Invalid userId (too long, bad chars) → 400 (no auth context needed)
 *   - Valid userId → 401 (passes validation, blocked by auth because no Clerk token is present)
 *
 * This structure lets CI verify the guardrails without needing real Clerk credentials.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import type { Server } from "node:http";
import app from "../app";

let baseUrl: string;
let server: Server;

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server = createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Unexpected server address"));
        return;
      }
      baseUrl = `http://127.0.0.1:${addr.port}/api`;
      resolve();
    });
    server.on("error", reject);
  });
});

afterAll(() => {
  server.close();
});

describe("userId validation — valid values reach the auth wall (401)", () => {
  it("GET valid UUID userId passes validation", async () => {
    const res = await fetch(`${baseUrl}/preferences/550e8400-e29b-41d4-a716-446655440000`);
    expect(res.status).toBe(401);
  });

  it("GET valid alphanumeric userId passes validation", async () => {
    const res = await fetch(`${baseUrl}/preferences/user123`);
    expect(res.status).toBe(401);
  });

  it("PUT valid UUID userId passes validation", async () => {
    const res = await fetch(`${baseUrl}/preferences/550e8400-e29b-41d4-a716-446655440001`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minimapVisible: true, tagsVisible: false }),
    });
    expect(res.status).toBe(401);
  });

  it("PUT valid alphanumeric userId passes validation", async () => {
    const res = await fetch(`${baseUrl}/preferences/testuser42`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minimapVisible: false, tagsVisible: true }),
    });
    expect(res.status).toBe(401);
  });

  it("GET userId exactly 128 chars passes validation (boundary)", async () => {
    const boundaryId = "a".repeat(128);
    const res = await fetch(`${baseUrl}/preferences/${boundaryId}`);
    expect(res.status).toBe(401);
  });
});

describe("userId validation — invalid values are rejected (400)", () => {
  it("GET userId longer than 128 chars returns 400", async () => {
    const longId = "a".repeat(129);
    const res = await fetch(`${baseUrl}/preferences/${longId}`);
    expect(res.status).toBe(400);
  });

  it("GET userId with special characters returns 400", async () => {
    const res = await fetch(`${baseUrl}/preferences/user@domain.com`);
    expect(res.status).toBe(400);
  });

  it("PUT userId longer than 128 chars returns 400", async () => {
    const longId = "b".repeat(129);
    const res = await fetch(`${baseUrl}/preferences/${longId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minimapVisible: true, tagsVisible: true }),
    });
    expect(res.status).toBe(400);
  });

  it("PUT userId with special characters returns 400", async () => {
    const res = await fetch(`${baseUrl}/preferences/bad!user`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minimapVisible: true, tagsVisible: true }),
    });
    expect(res.status).toBe(400);
  });
});

describe("body validation — unrecognised fields and missing fields", () => {
  it("PUT with unknown field returns 400 and lists the bad key in message", async () => {
    const testUserId = "testbodyvalid1";
    const res = await fetch(`${baseUrl}/preferences/${testUserId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Test-User-Id": testUserId,
      },
      body: JSON.stringify({ miimapVisible: true, tagsVisible: false }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string; validation: unknown };
    expect(body.message).toContain("miimapVisible");
    expect(body.message).toMatch(/^Unrecognised fields:/);
    expect(body.validation).not.toBeUndefined();
    expect(body.validation).not.toBeNull();
  });

  it("PUT with multiple unknown fields returns 400 and lists all bad keys", async () => {
    const testUserId = "testbodyvalid2";
    const res = await fetch(`${baseUrl}/preferences/${testUserId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Test-User-Id": testUserId,
      },
      body: JSON.stringify({ miimapVisible: true, tagsVisble: false }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string; validation: unknown };
    expect(body.message).toContain("miimapVisible");
    expect(body.message).toContain("tagsVisble");
    expect(body.validation).not.toBeUndefined();
    expect(body.validation).not.toBeNull();
  });

  it("PUT with missing required field returns 400 with fallback message", async () => {
    const testUserId = "testbodyvalid3";
    const res = await fetch(`${baseUrl}/preferences/${testUserId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Test-User-Id": testUserId,
      },
      body: JSON.stringify({ minimapVisible: true }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string; validation: unknown };
    expect(body.message).toBe("Invalid preferences payload");
    expect(body.validation).not.toBeUndefined();
    expect(body.validation).not.toBeNull();
  });

  it("PUT with empty body returns 400 with fallback message", async () => {
    const testUserId = "testbodyvalid4";
    const res = await fetch(`${baseUrl}/preferences/${testUserId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Test-User-Id": testUserId,
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string; validation: unknown };
    expect(body.message).toBe("Invalid preferences payload");
    expect(body.validation).not.toBeUndefined();
    expect(body.validation).not.toBeNull();
  });
});

describe("GET happy-path — valid userId with auth header returns correct shape", () => {
  it("GET with valid userId and X-Test-User-Id returns 200 with correct preference shape", async () => {
    const testUserId = "testgethappy1";
    const res = await fetch(`${baseUrl}/preferences/${testUserId}`, {
      headers: { "X-Test-User-Id": testUserId },
    });
    expect(res.status).toBe(200);
    const prefs = (await res.json()) as Record<string, unknown>;
    expect(prefs).not.toBeNull();
    expect(typeof prefs).toBe("object");
    expect("minimapVisible" in prefs).toBe(true);
    expect("tagsVisible" in prefs).toBe(true);
    expect(typeof prefs.minimapVisible).toBe("boolean");
    expect(typeof prefs.tagsVisible).toBe("boolean");
  });

  it("GET for user with no saved prefs returns the default values", async () => {
    const testUserId = "testgethappy2";
    const res = await fetch(`${baseUrl}/preferences/${testUserId}`, {
      headers: { "X-Test-User-Id": testUserId },
    });
    expect(res.status).toBe(200);
    const prefs = (await res.json()) as Record<string, unknown>;
    expect(prefs.minimapVisible).toBe(true);
    expect(prefs.tagsVisible).toBe(true);
  });
});

describe("round-trip — PUT then GET returns saved values, not defaults", () => {
  it("PUT then GET round-trip returns the saved values", async () => {
    const testUserId = "testroundtrip1";

    const putRes = await fetch(`${baseUrl}/preferences/${testUserId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Test-User-Id": testUserId,
      },
      body: JSON.stringify({ minimapVisible: false, tagsVisible: false }),
    });
    expect(putRes.status).toBe(200);

    const getRes = await fetch(`${baseUrl}/preferences/${testUserId}`, {
      headers: { "X-Test-User-Id": testUserId },
    });
    expect(getRes.status).toBe(200);
    const prefs = (await getRes.json()) as Record<string, unknown>;
    expect(prefs.minimapVisible).toBe(false);
    expect(prefs.tagsVisible).toBe(false);
  });
});
