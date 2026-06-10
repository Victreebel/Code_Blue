/**
 * Integration tests for userId validation rules on the preferences endpoints.
 *
 * The validation middleware runs BEFORE requireAuth, so:
 *   - Invalid userId (too long, bad chars) → 400 (no auth context needed)
 *   - Valid userId → 401 (passes validation, blocked by auth because no Clerk token is present)
 *
 * This structure lets CI verify the guardrails without needing real Clerk credentials.
 */

import { createServer } from "node:http";
import { strict as assert } from "node:assert";
import app from "../app";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];
const pending: Promise<void>[] = [];

function test(name: string, fn: () => void | Promise<void>) {
  const r = fn();
  if (r instanceof Promise) {
    const tracked = r.then(
      () => {
        results.push({ name, passed: true });
      },
      (e) => {
        results.push({ name, passed: false, error: String(e) });
      },
    );
    pending.push(tracked);
  } else {
    results.push({ name, passed: true });
  }
}

function startServer(): Promise<{ baseUrl: string; close: () => void }> {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Unexpected server address"));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}/api`,
        close: () => server.close(),
      });
    });
    server.on("error", reject);
  });
}

async function runTests() {
  const { baseUrl, close } = await startServer();

  try {
    // --- Valid userId: must pass validation (reach auth wall → 401, not 400) ---

    test("GET valid UUID userId passes validation (reaches auth check, returns 401)", async () => {
      const res = await fetch(
        `${baseUrl}/preferences/550e8400-e29b-41d4-a716-446655440000`,
      );
      assert.equal(
        res.status,
        401,
        `Expected 401 (auth wall reached) for valid UUID userId, got ${res.status}`,
      );
    });

    test("GET valid alphanumeric userId passes validation (reaches auth check, returns 401)", async () => {
      const res = await fetch(`${baseUrl}/preferences/user123`);
      assert.equal(
        res.status,
        401,
        `Expected 401 (auth wall reached) for valid alphanumeric userId, got ${res.status}`,
      );
    });

    test("PUT valid UUID userId passes validation (reaches auth check, returns 401)", async () => {
      const res = await fetch(
        `${baseUrl}/preferences/550e8400-e29b-41d4-a716-446655440001`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minimapVisible: true, tagsVisible: false }),
        },
      );
      assert.equal(
        res.status,
        401,
        `Expected 401 (auth wall reached) for PUT with valid UUID userId, got ${res.status}`,
      );
    });

    test("PUT valid alphanumeric userId passes validation (reaches auth check, returns 401)", async () => {
      const res = await fetch(`${baseUrl}/preferences/testuser42`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minimapVisible: false, tagsVisible: true }),
      });
      assert.equal(
        res.status,
        401,
        `Expected 401 (auth wall reached) for PUT with valid alphanumeric userId, got ${res.status}`,
      );
    });

    test("GET userId exactly 128 chars passes validation (boundary — returns 401)", async () => {
      const boundaryId = "a".repeat(128);
      const res = await fetch(`${baseUrl}/preferences/${boundaryId}`);
      assert.equal(
        res.status,
        401,
        `Expected 401 (auth wall reached) for userId of exactly 128 chars, got ${res.status}`,
      );
    });

    // --- Invalid userId: must be rejected by validation (400), before auth ---

    test("GET userId longer than 128 chars returns 400", async () => {
      const longId = "a".repeat(129);
      const res = await fetch(`${baseUrl}/preferences/${longId}`);
      assert.equal(
        res.status,
        400,
        `Expected 400 for userId > 128 chars, got ${res.status}`,
      );
    });

    test("GET userId with special characters returns 400", async () => {
      const res = await fetch(`${baseUrl}/preferences/user@domain.com`);
      assert.equal(
        res.status,
        400,
        `Expected 400 for userId with special chars (@, .), got ${res.status}`,
      );
    });

    test("PUT userId longer than 128 chars returns 400", async () => {
      const longId = "b".repeat(129);
      const res = await fetch(`${baseUrl}/preferences/${longId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minimapVisible: true, tagsVisible: true }),
      });
      assert.equal(
        res.status,
        400,
        `Expected 400 for PUT userId > 128 chars, got ${res.status}`,
      );
    });

    test("PUT userId with special characters returns 400", async () => {
      const res = await fetch(`${baseUrl}/preferences/bad!user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minimapVisible: true, tagsVisible: true }),
      });
      assert.equal(
        res.status,
        400,
        `Expected 400 for PUT userId with special chars (!), got ${res.status}`,
      );
    });

    // --- Body validation: unrecognised fields → 400 with descriptive message ---
    // Auth is bypassed per-request via X-Test-User-Id header (only active in NODE_ENV=test).

    test("PUT with unknown field returns 400 and lists the bad key in message", async () => {
      const testUserId = "testbodyvalid1";
      const res = await fetch(`${baseUrl}/preferences/${testUserId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Test-User-Id": testUserId,
        },
        body: JSON.stringify({ miimapVisible: true, tagsVisible: false }),
      });
      assert.equal(
        res.status,
        400,
        `Expected 400 for unknown field, got ${res.status}`,
      );
      const body = (await res.json()) as { message: string; validation: unknown };
      assert.ok(
        body.message.includes("miimapVisible"),
        `Expected message to list "miimapVisible", got: ${body.message}`,
      );
      assert.ok(
        body.message.startsWith("Unrecognised fields:"),
        `Expected message to start with "Unrecognised fields:", got: ${body.message}`,
      );
      assert.ok(
        body.validation !== undefined && body.validation !== null,
        `Expected "validation" field to be present in response`,
      );
    });

    test("PUT with multiple unknown fields returns 400 and lists all bad keys", async () => {
      const testUserId = "testbodyvalid2";
      const res = await fetch(`${baseUrl}/preferences/${testUserId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Test-User-Id": testUserId,
        },
        body: JSON.stringify({ miimapVisible: true, tagsVisble: false }),
      });
      assert.equal(
        res.status,
        400,
        `Expected 400 for multiple unknown fields, got ${res.status}`,
      );
      const body = (await res.json()) as { message: string; validation: unknown };
      assert.ok(
        body.message.includes("miimapVisible"),
        `Expected message to include "miimapVisible", got: ${body.message}`,
      );
      assert.ok(
        body.message.includes("tagsVisble"),
        `Expected message to include "tagsVisble", got: ${body.message}`,
      );
      assert.ok(
        body.validation !== undefined && body.validation !== null,
        `Expected "validation" field to be present in response`,
      );
    });

    // --- Body validation: missing required field (no unknown keys) → fallback message ---

    test("PUT with missing required field returns 400 with fallback message", async () => {
      const testUserId = "testbodyvalid3";
      const res = await fetch(`${baseUrl}/preferences/${testUserId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Test-User-Id": testUserId,
        },
        body: JSON.stringify({ minimapVisible: true }),
      });
      assert.equal(
        res.status,
        400,
        `Expected 400 for missing required field, got ${res.status}`,
      );
      const body = (await res.json()) as { message: string; validation: unknown };
      assert.equal(
        body.message,
        "Invalid preferences payload",
        `Expected fallback message for missing field, got: ${body.message}`,
      );
      assert.ok(
        body.validation !== undefined && body.validation !== null,
        `Expected "validation" field to be present in response`,
      );
    });

    test("PUT with empty body returns 400 with fallback message", async () => {
      const testUserId = "testbodyvalid4";
      const res = await fetch(`${baseUrl}/preferences/${testUserId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Test-User-Id": testUserId,
        },
        body: JSON.stringify({}),
      });
      assert.equal(
        res.status,
        400,
        `Expected 400 for empty body, got ${res.status}`,
      );
      const body = (await res.json()) as { message: string; validation: unknown };
      assert.equal(
        body.message,
        "Invalid preferences payload",
        `Expected fallback message for empty body, got: ${body.message}`,
      );
      assert.ok(
        body.validation !== undefined && body.validation !== null,
        `Expected "validation" field to be present in response`,
      );
    });

    // --- GET happy-path: valid userId + X-Test-User-Id header → 200 with correct shape ---

    test("GET with valid userId and X-Test-User-Id returns 200 with correct preference shape", async () => {
      const testUserId = "testgethappy1";
      const res = await fetch(`${baseUrl}/preferences/${testUserId}`, {
        headers: { "X-Test-User-Id": testUserId },
      });
      assert.equal(
        res.status,
        200,
        `Expected 200 for GET with valid userId and auth header, got ${res.status}`,
      );
      const body = (await res.json()) as unknown;
      assert.ok(
        body !== null && typeof body === "object",
        "Expected response body to be an object",
      );
      const prefs = body as Record<string, unknown>;
      assert.ok(
        "minimapVisible" in prefs,
        `Expected "minimapVisible" field in response, got: ${JSON.stringify(prefs)}`,
      );
      assert.ok(
        "tagsVisible" in prefs,
        `Expected "tagsVisible" field in response, got: ${JSON.stringify(prefs)}`,
      );
      assert.equal(
        typeof prefs.minimapVisible,
        "boolean",
        `Expected minimapVisible to be boolean, got ${typeof prefs.minimapVisible}`,
      );
      assert.equal(
        typeof prefs.tagsVisible,
        "boolean",
        `Expected tagsVisible to be boolean, got ${typeof prefs.tagsVisible}`,
      );
    });

    test("GET for user with no saved prefs returns the default values", async () => {
      const testUserId = "testgethappy2";
      const res = await fetch(`${baseUrl}/preferences/${testUserId}`, {
        headers: { "X-Test-User-Id": testUserId },
      });
      assert.equal(
        res.status,
        200,
        `Expected 200 for GET default prefs fallback, got ${res.status}`,
      );
      const prefs = (await res.json()) as Record<string, unknown>;
      assert.equal(
        prefs.minimapVisible,
        true,
        `Expected default minimapVisible to be true, got ${prefs.minimapVisible}`,
      );
      assert.equal(
        prefs.tagsVisible,
        true,
        `Expected default tagsVisible to be true, got ${prefs.tagsVisible}`,
      );
    });

    await Promise.all(pending);
  } finally {
    close();
  }
}

runTests()
  .then(() => {
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed);
    console.log(`\n${passed}/${results.length} tests passed`);
    for (const r of results) {
      if (r.passed) {
        console.log(`  ✓ ${r.name}`);
      } else {
        console.log(`  ✗ ${r.name}`);
        console.log(`    ${r.error}`);
      }
    }
    if (failed.length > 0) process.exit(1);
  })
  .catch((err) => {
    console.error("Test setup failed:", err);
    process.exit(1);
  });
