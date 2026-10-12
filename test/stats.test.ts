import { describe, it, expect } from "vitest";
import { percentile } from "../src/stats.ts";

describe("percentile", () => {
  it("returns null for no samples", () => {
    expect(percentile([], 50)).toBeNull();
  });
  it("uses the nearest-rank method for p50 and p95", () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(percentile(values, 50)).toBe(10);
    expect(percentile(values, 95)).toBe(19);
  });
  it("does not change its input order and handles one sample", () => {
    const values = [30, 10, 20];
    expect(percentile(values, 50)).toBe(20);
    expect(values).toEqual([30, 10, 20]);
    expect(percentile([7], 95)).toBe(7);
  });
  it("rejects a percentile outside 0 to 100", () => {
    expect(() => percentile([1], 101)).toThrow(RangeError);
  });
});
