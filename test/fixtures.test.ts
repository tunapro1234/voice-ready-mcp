import { describe, it, expect } from "vitest";
import { parseFixtures, FixtureError } from "../src/fixtures.ts";

describe("parseFixtures", () => {
  it("accepts tool calls and defaults arguments to an empty object", () => {
    expect(parseFixtures([{ tool: "a" }, { tool: "b", arguments: { x: 1 } }])).toEqual([
      { tool: "a", arguments: {} },
      { tool: "b", arguments: { x: 1 } },
    ]);
  });
  it("rejects a non-array, a missing tool name and non-object arguments", () => {
    expect(() => parseFixtures({})).toThrow(FixtureError);
    expect(() => parseFixtures([{ arguments: {} }])).toThrow(/"tool"/);
    expect(() => parseFixtures([{ tool: "a", arguments: [] }])).toThrow(/"arguments"/);
  });
});
