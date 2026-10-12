import type { Report, Status } from "./types.ts";

export function exitCode(report: Report): 0 | 1 {
  return report.checks.some((c) => c.status === "fail") ? 1 : 0;
}

const LABEL: Record<Status, string> = { pass: "PASS", warn: "WARN", fail: "FAIL" };

function fmtMs(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(1)} ms`;
}

/** Human-readable table for stdout. Details are indented under their check. */
export function formatReport(report: Report): string {
  const lines: string[] = [];
  lines.push(`voice-ready-mcp report for ${report.target}`);
  lines.push("");
  const idWidth = Math.max(5, ...report.checks.map((c) => c.id.length));
  lines.push(`${"CHECK".padEnd(idWidth)}  STATUS  DETAILS`);
  for (const check of report.checks) {
    const [first = "", ...rest] = check.details;
    lines.push(`${check.id.padEnd(idWidth)}  ${LABEL[check.status].padEnd(6)}  ${first}`);
    for (const more of rest) lines.push(`${" ".repeat(idWidth)}  ${" ".repeat(6)}  ${more}`);
  }
  lines.push("");
  const { p50, p95, budget } = report.latency;
  lines.push(`latency: p50 ${fmtMs(p50)}, p95 ${fmtMs(p95)}, budget ${budget} ms`);
  const failed = report.checks.filter((c) => c.status === "fail").length;
  const warned = report.checks.filter((c) => c.status === "warn").length;
  lines.push(`result: ${failed === 0 ? "ready" : "not ready"} (${failed} failed, ${warned} warned)`);
  return lines.join("\n") + "\n";
}
