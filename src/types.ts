export type CheckId = "speakable" | "latency" | "transport" | "mcp-apps";
export type Status = "pass" | "warn" | "fail";

export type CheckResult = {
  id: CheckId;
  status: Status;
  details: string[];
};

export type LatencySummary = {
  /** Median over every timed call, in milliseconds. Null when no call was timed. */
  p50: number | null;
  /** 95th percentile over every timed call, in milliseconds. Null when no call was timed. */
  p95: number | null;
  /** The budget the p95 was compared with, in milliseconds. */
  budget: number;
};

export type Report = {
  checks: CheckResult[];
  latency: LatencySummary;
  target: string;
};

/** One line of the --fixtures file: a tools/call to make against the server. */
export type FixtureCall = {
  tool: string;
  arguments: Record<string, unknown>;
};

export type RunOptions = {
  /** Streamable HTTP endpoint, for example http://127.0.0.1:3000/mcp */
  url: string;
  fixtures: FixtureCall[];
  /** Extra request headers, for example { Authorization: "Bearer ..." }. */
  headers?: Record<string, string>;
  /** Default 500. Latency p95 above this is a warning, or a failure with strict. */
  budgetMs?: number;
  /** Default 240. */
  maxChars?: number;
  /** Timed calls per fixture. Default 50. */
  runs?: number;
  /** Default false. When true, a latency budget miss is a failure instead of a warning. */
  strict?: boolean;
};
