import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, USAGE } from "../src/main.ts";
import { VERSION } from "../src/version.ts";
import { startGoodServer } from "./fixtures/good-server.ts";
import type { TestServer } from "./fixtures/serve.ts";

let server: TestServer;
let dir: string;

beforeAll(async () => {
  server = await startGoodServer();
  dir = await mkdtemp(join(tmpdir(), "vrm-test-"));
});

afterAll(async () => {
  await server?.close();
  await rm(dir, { recursive: true, force: true });
});

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, streams: { stdout: (t: string) => out.push(t), stderr: (t: string) => err.push(t) } };
}

describe("main", () => {
  it("prints usage and exits 0 for --help", async () => {
    const c = capture();
    expect(await main(["--help"], c.streams)).toBe(0);
    expect(c.out.join("")).toBe(USAGE);
  });
  it("exits 2 with a message for a usage error", async () => {
    const c = capture();
    expect(await main(["--fixtures", "x.json"], c.streams)).toBe(2);
    expect(c.err.join("")).toContain("--url is required");
  });
  it("exits 2 when the fixtures file is missing", async () => {
    const c = capture();
    expect(await main(["--url", server.url, "--fixtures", join(dir, "missing.json")], c.streams)).toBe(2);
    expect(c.err.join("")).toContain("cannot read fixtures file");
  });
  it("runs against the good server, writes report.json and exits 0", async () => {
    const fixtures = join(dir, "calls.json");
    const json = join(dir, "report.json");
    await writeFile(fixtures, JSON.stringify([{ tool: "summarize_day", arguments: {} }]));
    const c = capture();
    const code = await main(
      ["--url", server.url, "--fixtures", fixtures, "--json", json, "--runs", "2", "--budget-ms", "5000"],
      c.streams,
    );
    expect(code).toBe(0);
    expect(c.out.join("")).toContain("result: ready");
    const report = JSON.parse(await readFile(json, "utf8"));
    expect(report.checks.map((x: { id: string }) => x.id)).toEqual(["speakable", "latency", "transport", "mcp-apps"]);
    expect(report.latency.budget).toBe(5000);
  });
  it("keeps the version constant in step with package.json", async () => {
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    expect(VERSION).toBe(pkg.version);
  });
});
