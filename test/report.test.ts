import { describe, it, expect } from "vitest";
import { exitCode, formatReport } from "../src/report.ts";
import type { Report } from "../src/types.ts";

const report: Report = {
  target: "http://127.0.0.1:1/mcp",
  latency: { p50: 3.2, p95: 9.9, budget: 500 },
  checks: [
    { id: "speakable", status: "pass", details: ["check_order_status: speakable"] },
    { id: "latency", status: "warn", details: ["all calls: p50 3.2 ms", "p95 is over the budget"] },
    { id: "transport", status: "fail", details: ["foreign Origin: expected 403, got 200"] },
    { id: "mcp-apps", status: "pass", details: ["ui://voice-ready/dashboard (open_dashboard): text/html;profile=mcp-app"] },
  ],
};

describe("report", () => {
  it("exits 1 when any check fails and 0 otherwise", () => {
    expect(exitCode(report)).toBe(1);
    expect(exitCode({ ...report, checks: report.checks.filter((c) => c.status !== "fail") })).toBe(0);
  });
  it("exits 0 when checks only warn", () => {
    expect(exitCode({ ...report, checks: [report.checks[1]!] })).toBe(0);
  });
  it("prints one row per check with its status label", () => {
    const text = formatReport(report);
    expect(text).toMatch(/speakable\s+PASS/);
    expect(text).toMatch(/latency\s+WARN/);
    expect(text).toMatch(/transport\s+FAIL/);
    expect(text).toContain("latency: p50 3.2 ms, p95 9.9 ms, budget 500 ms");
    expect(text).toContain("result: not ready (1 failed, 1 warned)");
  });
  it("serializes to the documented JSON shape", () => {
    const json = JSON.parse(JSON.stringify(report)) as Report;
    expect(Object.keys(json).sort()).toEqual(["checks", "latency", "target"]);
    expect(json.checks[0]).toEqual({ id: "speakable", status: "pass", details: ["check_order_status: speakable"] });
    expect(json.latency).toEqual({ p50: 3.2, p95: 9.9, budget: 500 });
  });
});
