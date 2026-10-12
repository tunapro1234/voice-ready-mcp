import type { FixtureCall, CheckResult } from "../types.ts";
import type { McpSession } from "../session.ts";
import { errorMessage } from "../session.ts";
import { speakableProblems } from "../text-rules.ts";

export type SpeakableInput = {
  session: McpSession;
  fixtures: FixtureCall[];
  maxChars: number;
};

/** Calls each fixture once and checks the first text block of the reply. */
export async function checkSpeakable(input: SpeakableInput): Promise<CheckResult> {
  if (input.fixtures.length === 0) {
    return { id: "speakable", status: "warn", details: ["no fixtures given, nothing was checked"] };
  }
  const details: string[] = [];
  let failed = false;
  for (const call of input.fixtures) {
    try {
      const result = await input.session.client.callTool({ name: call.tool, arguments: call.arguments });
      const problems: string[] = [];
      if (result.isError) problems.push("tool reported isError");
      const first = Array.isArray(result.content) ? result.content[0] : undefined;
      if (first?.type !== "text" || typeof first.text !== "string") {
        problems.push("first content block is not text");
      } else {
        problems.push(...speakableProblems(first.text, { maxChars: input.maxChars }));
      }
      if (problems.length) {
        failed = true;
        details.push(`${call.tool}: ${problems.join("; ")}`);
      } else {
        details.push(`${call.tool}: speakable`);
      }
    } catch (e) {
      failed = true;
      details.push(`${call.tool}: call failed (${errorMessage(e)})`);
    }
  }
  return { id: "speakable", status: failed ? "fail" : "pass", details };
}
