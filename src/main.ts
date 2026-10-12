import { writeFile } from "node:fs/promises";
import { parseArgs, UsageError, DEFAULTS } from "./cli-args.ts";
import { loadFixtures, FixtureError } from "./fixtures.ts";
import { runChecks } from "./run.ts";
import { exitCode, formatReport } from "./report.ts";

export const USAGE = `Usage: voice-ready-mcp --url <http-url> --fixtures <calls.json> [options]

Checks whether an MCP server is ready for a voice assistant.

Options:
  --url <url>           Streamable HTTP endpoint, for example http://127.0.0.1:3000/mcp (required)
  --fixtures <file>     JSON array of {"tool": "name", "arguments": {...}} calls (required)
  --json <file>         Also write the report as JSON to this file
  --header "Name: v"    Extra request header, repeatable (for example Authorization)
  --budget-ms <n>       Latency budget for p95 in milliseconds (default ${DEFAULTS.budgetMs})
  --max-chars <n>       Longest speakable reply in characters (default ${DEFAULTS.maxChars})
  --runs <n>            Timed calls per fixture (default ${DEFAULTS.runs})
  --strict              Fail, not warn, when p95 is over the budget
  -h, --help            Show this help

Exit codes: 0 when no check fails, 1 when a check fails, 2 for usage or fixture errors.
`;

export type Streams = { stdout: (text: string) => void; stderr: (text: string) => void };

/** Runs the CLI with the given arguments (without node and script path) and returns the exit code. */
export async function main(argv: readonly string[], streams: Streams): Promise<0 | 1 | 2> {
  let options;
  try {
    options = parseArgs(argv);
  } catch (e) {
    if (e instanceof UsageError) {
      streams.stderr(`voice-ready-mcp: ${e.message}\n\n${USAGE}`);
      return 2;
    }
    throw e;
  }
  if (options.help) {
    streams.stdout(USAGE);
    return 0;
  }
  let fixtures;
  try {
    fixtures = await loadFixtures(options.fixtures);
  } catch (e) {
    if (e instanceof FixtureError) {
      streams.stderr(`voice-ready-mcp: ${e.message}\n`);
      return 2;
    }
    throw e;
  }
  const report = await runChecks({
    url: options.url,
    fixtures,
    headers: options.headers,
    budgetMs: options.budgetMs,
    maxChars: options.maxChars,
    runs: options.runs,
    strict: options.strict,
  });
  streams.stdout(formatReport(report));
  if (options.json) await writeFile(options.json, JSON.stringify(report, null, 2) + "\n", "utf8");
  return exitCode(report);
}
