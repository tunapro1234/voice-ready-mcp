import { describe, it, expect } from "vitest";
import { parseArgs, UsageError } from "../src/cli-args.ts";

const base = ["--url", "http://127.0.0.1:3000/mcp", "--fixtures", "calls.json"];

describe("parseArgs", () => {
  it("applies the documented defaults", () => {
    const o = parseArgs(base);
    expect(o).toMatchObject({ budgetMs: 500, maxChars: 240, runs: 50, strict: false, headers: {} });
  });
  it("reads every flag, including --flag=value and repeated headers", () => {
    const o = parseArgs([
      "--url=http://127.0.0.1:1/mcp",
      "--fixtures", "f.json",
      "--json", "r.json",
      "--header", "Authorization: Bearer abc",
      "--header", "X-Trace: 1",
      "--budget-ms", "250",
      "--max-chars", "120",
      "--runs", "5",
      "--strict",
    ]);
    expect(o.url).toBe("http://127.0.0.1:1/mcp");
    expect(o.json).toBe("r.json");
    expect(o.headers).toEqual({ Authorization: "Bearer abc", "X-Trace": "1" });
    expect(o).toMatchObject({ budgetMs: 250, maxChars: 120, runs: 5, strict: true });
  });
  it("requires --url and --fixtures", () => {
    expect(() => parseArgs(["--fixtures", "f.json"])).toThrow(UsageError);
    expect(() => parseArgs(["--url", "http://127.0.0.1/mcp"])).toThrow(UsageError);
  });
  it("rejects a non-http URL, a bad number and an unknown flag", () => {
    expect(() => parseArgs(["--url", "ftp://x", "--fixtures", "f"])).toThrow(/http or https/);
    expect(() => parseArgs([...base, "--runs", "0"])).toThrow(/positive/);
    expect(() => parseArgs([...base, "--runs", "2.5"])).toThrow(/whole number/);
    expect(() => parseArgs([...base, "--nope"])).toThrow(/unknown argument/);
  });
  it("rejects a header without a colon and a flag without a value", () => {
    expect(() => parseArgs([...base, "--header", "Bearer abc"])).toThrow(/Name: value/);
    expect(() => parseArgs(["--url"])).toThrow(/needs a value/);
  });
  it("accepts --help without --url", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
  });
});
