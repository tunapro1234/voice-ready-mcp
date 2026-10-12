import { readFile } from "node:fs/promises";
import type { FixtureCall } from "./types.ts";

export class FixtureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FixtureError";
  }
}

/** Validates the parsed JSON of a fixtures file: an array of { tool, arguments? }. */
export function parseFixtures(value: unknown): FixtureCall[] {
  if (!Array.isArray(value)) throw new FixtureError("fixtures must be a JSON array");
  return value.map((item, i) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new FixtureError(`fixture ${i} must be an object`);
    }
    const { tool, arguments: args } = item as { tool?: unknown; arguments?: unknown };
    if (typeof tool !== "string" || tool.trim() === "") {
      throw new FixtureError(`fixture ${i} needs a non-empty "tool" string`);
    }
    if (args !== undefined && (typeof args !== "object" || args === null || Array.isArray(args))) {
      throw new FixtureError(`fixture ${i} "arguments" must be an object`);
    }
    return { tool, arguments: (args as Record<string, unknown> | undefined) ?? {} };
  });
}

export async function loadFixtures(path: string): Promise<FixtureCall[]> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (e) {
    throw new FixtureError(`cannot read fixtures file ${path}: ${(e as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new FixtureError(`fixtures file ${path} is not valid JSON: ${(e as Error).message}`);
  }
  return parseFixtures(parsed);
}
