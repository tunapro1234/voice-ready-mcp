// Library entry point. The CLI is a thin wrapper around these exports.
export { runChecks, DEFAULT_BUDGET_MS, DEFAULT_MAX_CHARS, DEFAULT_RUNS } from "./run.ts";
export { parseArgs, UsageError, DEFAULTS } from "./cli-args.ts";
export type { CliOptions } from "./cli-args.ts";
export { loadFixtures, parseFixtures, FixtureError } from "./fixtures.ts";
export { formatReport, exitCode } from "./report.ts";
export { countSentences, speakableProblems, findEmoji, findMarkdown, findPipes, findRawUris } from "./text-rules.ts";
export { percentile } from "./stats.ts";
export { checkSpeakable } from "./checks/speakable.ts";
export { checkLatency } from "./checks/latency.ts";
export { checkTransport, FOREIGN_ORIGIN, UNSUPPORTED_PROTOCOL_VERSION } from "./checks/transport.ts";
export { checkMcpApps, resourceUriOf, MCP_APP_MIME } from "./checks/mcp-apps.ts";
export { main } from "./main.ts";
export { VERSION } from "./version.ts";
export type { CheckId, CheckResult, Status, Report, LatencySummary, FixtureCall, RunOptions } from "./types.ts";
