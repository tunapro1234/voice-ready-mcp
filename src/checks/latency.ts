import type { FixtureCall, CheckResult, LatencySummary } from "../types.ts";
import type { McpSession } from "../session.ts";
import { errorMessage } from "../session.ts";
import { percentile } from "../stats.ts";

export type LatencyInput = {
  session: McpSession;
  fixtures: FixtureCall[];
  runs: number;
  budgetMs: number;
  strict: boolean;
};

export type LatencyOutcome = { check: CheckResult; latency: LatencySummary };

/**
 * Times each fixture call `runs` times on one session. p50 and p95 are taken over all
 * timed calls together. The p95 is compared with the budget. Nothing is hardcoded:
 * the numbers are whatever this run measured.
 */
export async function checkLatency(input: LatencyInput): Promise<LatencyOutcome> {
  const latency: LatencySummary = { p50: null, p95: null, budget: input.budgetMs };
  if (input.fixtures.length === 0) {
    return { check: { id: "latency", status: "warn", details: ["no fixtures given, nothing was timed"] }, latency };
  }
  const samples: number[] = [];
  const details: string[] = [];
  let errors = 0;
  for (const call of input.fixtures) {
    const own: number[] = [];
    for (let i = 0; i < input.runs; i++) {
      const started = performance.now();
      try {
        await input.session.client.callTool({ name: call.tool, arguments: call.arguments });
        const elapsed = performance.now() - started;
        own.push(elapsed);
        samples.push(elapsed);
      } catch (e) {
        errors++;
        details.push(`${call.tool}: run ${i + 1} failed (${errorMessage(e)})`);
      }
    }
    if (own.length) {
      details.push(
        `${call.tool}: p50 ${percentile(own, 50)?.toFixed(1)} ms, p95 ${percentile(own, 95)?.toFixed(1)} ms over ${own.length} runs`,
      );
    }
  }

  if (samples.length === 0) {
    return { check: { id: "latency", status: "fail", details: [...details, "no call completed"] }, latency };
  }
  // Rounded to 0.1 ms so the report and the JSON show the same figures.
  const round = (v: number | null): number | null => (v === null ? null : Math.round(v * 10) / 10);
  latency.p50 = round(percentile(samples, 50));
  latency.p95 = round(percentile(samples, 95));
  const p95 = latency.p95 ?? 0;
  const overall = `all calls: p50 ${latency.p50?.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, budget ${input.budgetMs} ms`;
  details.unshift(overall);

  if (errors > 0) {
    return { check: { id: "latency", status: "fail", details }, latency };
  }
  if (p95 > input.budgetMs) {
    details.push("p95 is over the budget");
    return { check: { id: "latency", status: input.strict ? "fail" : "warn", details }, latency };
  }
  return { check: { id: "latency", status: "pass", details }, latency };
}
