import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runChecks } from "../src/run.ts";
import { checkTransport } from "../src/checks/transport.ts";
import { checkMcpApps, resourceUriOf } from "../src/checks/mcp-apps.ts";
import { checkLatency } from "../src/checks/latency.ts";
import { checkSpeakable } from "../src/checks/speakable.ts";
import { connect } from "../src/session.ts";
import { startGoodServer } from "./fixtures/good-server.ts";
import { startBadServer } from "./fixtures/bad-server.ts";
import type { TestServer } from "./fixtures/serve.ts";
import type { FixtureCall } from "../src/types.ts";

const GOOD_CALLS: FixtureCall[] = [
  { tool: "check_order_status", arguments: { orderId: "A-100" } },
  { tool: "summarize_day", arguments: {} },
  { tool: "open_dashboard", arguments: {} },
];
const BAD_CALLS: FixtureCall[] = [
  { tool: "markdown_reply", arguments: {} },
  { tool: "slow_reply", arguments: {} },
];

let good: TestServer;
let bad: TestServer;
let slow: TestServer;

beforeAll(async () => {
  good = await startGoodServer();
  bad = await startBadServer(0);
  slow = await startBadServer(80);
});

afterAll(async () => {
  await good?.close();
  await bad?.close();
  await slow?.close();
});

describe("speakable check", () => {
  it("passes when every reply is short plain text", async () => {
    const session = await connect(good.url);
    try {
      const result = await checkSpeakable({ session, fixtures: GOOD_CALLS, maxChars: 240 });
      expect(result.status).toBe("pass");
    } finally {
      await session.close();
    }
  });
  it("fails on markdown, pipes, emoji, a raw URI and length", async () => {
    const session = await connect(bad.url);
    try {
      const result = await checkSpeakable({ session, fixtures: BAD_CALLS, maxChars: 240 });
      expect(result.status).toBe("fail");
      expect(result.details.join("\n")).toMatch(/markdown|pipe|emoji|URI|sentences|characters/);
    } finally {
      await session.close();
    }
  });
});

describe("latency check", () => {
  it("passes when p95 is inside a generous budget", async () => {
    const session = await connect(good.url);
    try {
      const { check, latency } = await checkLatency({ session, fixtures: GOOD_CALLS, runs: 3, budgetMs: 5000, strict: false });
      expect(check.status).toBe("pass");
      expect(latency.p95).not.toBeNull();
      expect(latency.budget).toBe(5000);
    } finally {
      await session.close();
    }
  });
  it("warns when p95 is over the budget and fails under strict", async () => {
    const session = await connect(slow.url);
    try {
      const lax = await checkLatency({ session, fixtures: [{ tool: "slow_reply", arguments: {} }], runs: 2, budgetMs: 20, strict: false });
      expect(lax.check.status).toBe("warn");
      const strict = await checkLatency({ session, fixtures: [{ tool: "slow_reply", arguments: {} }], runs: 2, budgetMs: 20, strict: true });
      expect(strict.check.status).toBe("fail");
    } finally {
      await session.close();
    }
  });
});

describe("transport check", () => {
  it("passes when a foreign Origin gets 403 and a bad version gets 400", async () => {
    const result = await checkTransport({ url: good.url, headers: {} });
    expect(result.status).toBe("pass");
  });
  it("fails when the server accepts any Origin and any version", async () => {
    const result = await checkTransport({ url: bad.url, headers: {} });
    expect(result.status).toBe("fail");
    expect(result.details.join("\n")).toContain("expected 403");
    expect(result.details.join("\n")).toContain("expected 400");
  });
});

describe("mcp-apps check", () => {
  it("passes when the view reads back as text/html;profile=mcp-app", async () => {
    const session = await connect(good.url);
    try {
      expect((await checkMcpApps(session)).status).toBe("pass");
    } finally {
      await session.close();
    }
  });
  it("fails when the view is served as plain text/html", async () => {
    const session = await connect(bad.url);
    try {
      const result = await checkMcpApps(session);
      expect(result.status).toBe("fail");
      expect(result.details.join("\n")).toContain("expected text/html;profile=mcp-app, got text/html");
    } finally {
      await session.close();
    }
  });
  it("reads _meta.ui.resourceUri and ignores tools without it", () => {
    expect(resourceUriOf({ name: "t", _meta: { ui: { resourceUri: "ui://a/b" } } })).toBe("ui://a/b");
    expect(resourceUriOf({ name: "t" })).toBeUndefined();
  });
});

describe("runChecks", () => {
  it("reports all four checks as pass against the good server", async () => {
    const report = await runChecks({ url: good.url, fixtures: GOOD_CALLS, runs: 2, budgetMs: 5000 });
    expect(report.checks.map((c) => c.id)).toEqual(["speakable", "latency", "transport", "mcp-apps"]);
    expect(report.checks.every((c) => c.status === "pass")).toBe(true);
    expect(report.latency.budget).toBe(5000);
  });
  it("fails the report against the bad server", async () => {
    const report = await runChecks({ url: bad.url, fixtures: BAD_CALLS, runs: 1, budgetMs: 5000 });
    expect(report.checks.find((c) => c.id === "speakable")?.status).toBe("fail");
    expect(report.checks.find((c) => c.id === "transport")?.status).toBe("fail");
    expect(report.checks.find((c) => c.id === "mcp-apps")?.status).toBe("fail");
  });
  it("fails every check that needs a session when the server is unreachable", async () => {
    const report = await runChecks({ url: "http://127.0.0.1:1/mcp", fixtures: GOOD_CALLS, runs: 1 });
    expect(report.checks.find((c) => c.id === "speakable")?.status).toBe("fail");
    expect(report.checks.find((c) => c.id === "transport")?.status).toBe("fail");
  });
  it("rejects a non-positive budget", async () => {
    await expect(runChecks({ url: good.url, fixtures: [], budgetMs: 0 })).rejects.toThrow(RangeError);
  });
});
