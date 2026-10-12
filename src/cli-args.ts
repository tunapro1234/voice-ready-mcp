// Command-line parsing for the voice-ready-mcp binary. Pure function, so it is testable without a process.

export type CliOptions = {
  url: string;
  fixtures: string;
  json?: string;
  headers: Record<string, string>;
  budgetMs: number;
  maxChars: number;
  runs: number;
  strict: boolean;
  help: boolean;
};

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

export const DEFAULTS = { budgetMs: 500, maxChars: 240, runs: 50 } as const;

const VALUE_FLAGS = new Set(["--url", "--fixtures", "--json", "--header", "--budget-ms", "--max-chars", "--runs"]);
const SWITCH_FLAGS = new Set(["--strict", "--help", "-h"]);

function positiveNumber(flag: string, raw: string): number {
  const n = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(n) || n <= 0) {
    throw new UsageError(`${flag} needs a positive number, got "${raw}"`);
  }
  return n;
}

function positiveInteger(flag: string, raw: string): number {
  const n = positiveNumber(flag, raw);
  if (!Number.isInteger(n)) throw new UsageError(`${flag} needs a whole number, got "${raw}"`);
  return n;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  const values = new Map<string, string[]>();
  const switches = new Set<string>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (SWITCH_FLAGS.has(arg)) {
      switches.add(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const flag = arg.startsWith("--") && eq > 0 ? arg.slice(0, eq) : arg;
    if (!VALUE_FLAGS.has(flag)) throw new UsageError(`unknown argument "${arg}"`);
    let value: string;
    if (eq > 0 && arg.startsWith("--")) {
      value = arg.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next === undefined) throw new UsageError(`${flag} needs a value`);
      value = next;
      i++;
    }
    values.set(flag, [...(values.get(flag) ?? []), value]);
  }

  const last = (flag: string): string | undefined => values.get(flag)?.at(-1);

  const help = switches.has("--help") || switches.has("-h");
  if (help) {
    return {
      url: last("--url") ?? "",
      fixtures: last("--fixtures") ?? "",
      json: last("--json"),
      headers: {},
      budgetMs: DEFAULTS.budgetMs,
      maxChars: DEFAULTS.maxChars,
      runs: DEFAULTS.runs,
      strict: switches.has("--strict"),
      help,
    };
  }

  const url = last("--url");
  if (!url) throw new UsageError("--url is required");
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("scheme");
  } catch {
    throw new UsageError(`--url must be an http or https URL, got "${url}"`);
  }
  const fixtures = last("--fixtures");
  if (!fixtures) throw new UsageError("--fixtures is required");

  const headers: Record<string, string> = {};
  for (const raw of values.get("--header") ?? []) {
    const colon = raw.indexOf(":");
    if (colon <= 0) throw new UsageError(`--header must look like "Name: value", got "${raw}"`);
    headers[raw.slice(0, colon).trim()] = raw.slice(colon + 1).trim();
  }

  const budget = last("--budget-ms");
  const maxChars = last("--max-chars");
  const runs = last("--runs");
  const json = last("--json");
  if (json !== undefined && json.trim() === "") throw new UsageError("--json needs a file path");

  return {
    url,
    fixtures,
    json,
    headers,
    budgetMs: budget === undefined ? DEFAULTS.budgetMs : positiveNumber("--budget-ms", budget),
    maxChars: maxChars === undefined ? DEFAULTS.maxChars : positiveInteger("--max-chars", maxChars),
    runs: runs === undefined ? DEFAULTS.runs : positiveInteger("--runs", runs),
    strict: switches.has("--strict"),
    help: false,
  };
}
