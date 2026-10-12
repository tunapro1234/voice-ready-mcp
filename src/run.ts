import { connect, errorMessage } from "./session.ts";
import { checkSpeakable } from "./checks/speakable.ts";
import { checkLatency } from "./checks/latency.ts";
import { checkTransport } from "./checks/transport.ts";
import { checkMcpApps } from "./checks/mcp-apps.ts";
import type { CheckResult, Report, RunOptions, LatencySummary } from "./types.ts";

export const DEFAULT_BUDGET_MS = 500;
export const DEFAULT_MAX_CHARS = 240;
export const DEFAULT_RUNS = 50;

function positive(name: string, value: number, integer: boolean): void {
  if (!Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value))) {
    throw new RangeError(`${name} must be a ${integer ? "whole" : "positive"} number, got ${value}`);
  }
}

/** Runs the four checks against a Streamable HTTP MCP server and returns the report. */
export async function runChecks(options: RunOptions): Promise<Report> {
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const runs = options.runs ?? DEFAULT_RUNS;
  positive("budgetMs", budgetMs, false);
  positive("maxChars", maxChars, true);
  positive("runs", runs, true);
  const headers = options.headers ?? {};
  const fixtures = options.fixtures;

  const checks: CheckResult[] = [];
  const latency: LatencySummary = { p50: null, p95: null, budget: budgetMs };
  const failAll = (id: CheckResult["id"], why: string): CheckResult => ({ id, status: "fail", details: [why] });

  let session: Awaited<ReturnType<typeof connect>> | undefined;
  try {
    session = await connect(options.url, headers);
  } catch (e) {
    const why = `cannot open an MCP session at ${options.url} (${errorMessage(e)})`;
    checks.push(failAll("speakable", why), failAll("latency", why), failAll("mcp-apps", why));
  }

  try {
    if (session) {
      const current = session;
      const speakable = await checkSpeakable({ session: current, fixtures, maxChars }).catch((e) =>
        failAll("speakable", errorMessage(e)),
      );
      checks.push(speakable);

      const timed = await checkLatency({
        session: current,
        fixtures,
        runs,
        budgetMs,
        strict: options.strict ?? false,
      }).catch((e) => ({ check: failAll("latency", errorMessage(e)), latency }));
      checks.push(timed.check);
      Object.assign(latency, timed.latency);

      checks.push(
        await checkMcpApps(current).catch((e) => failAll("mcp-apps", errorMessage(e))),
      );
    }
    checks.push(
      await checkTransport({ url: options.url, headers }).catch((e) => failAll("transport", errorMessage(e))),
    );
  } finally {
    await session?.close();
  }

  const order = ["speakable", "latency", "transport", "mcp-apps"];
  checks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return { checks, latency, target: options.url };
}
