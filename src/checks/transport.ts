import type { CheckResult } from "../types.ts";
import { errorMessage } from "../session.ts";
import { VERSION } from "../version.ts";

export const FOREIGN_ORIGIN = "https://foreign-origin.example";
export const UNSUPPORTED_PROTOCOL_VERSION = "1900-01-01";

export type TransportInput = {
  url: string;
  headers: Record<string, string>;
  timeoutMs?: number;
};

function initializeBody(): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "voice-ready-mcp", version: VERSION },
    },
  });
}

async function probe(input: TransportInput, extra: Record<string, string>): Promise<number> {
  const response = await fetch(input.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...input.headers,
      ...extra,
    },
    body: initializeBody(),
    signal: AbortSignal.timeout(input.timeoutMs ?? 5000),
  });
  await response.body?.cancel();
  return response.status;
}

/**
 * Sends two raw requests that a voice-facing server must refuse: one from a foreign Origin
 * (expects 403) and one with an unsupported MCP-Protocol-Version (expects 400).
 */
export async function checkTransport(input: TransportInput): Promise<CheckResult> {
  const details: string[] = [];
  let ok = true;
  try {
    const origin = await probe(input, { origin: FOREIGN_ORIGIN });
    if (origin === 403) details.push(`foreign Origin refused with 403`);
    else {
      ok = false;
      details.push(`foreign Origin: expected 403, got ${origin}`);
    }
  } catch (e) {
    ok = false;
    details.push(`foreign Origin probe failed (${errorMessage(e)})`);
  }
  try {
    const version = await probe(input, { "mcp-protocol-version": UNSUPPORTED_PROTOCOL_VERSION });
    if (version === 400) details.push(`unsupported MCP-Protocol-Version refused with 400`);
    else {
      ok = false;
      details.push(`unsupported MCP-Protocol-Version: expected 400, got ${version}`);
    }
  } catch (e) {
    ok = false;
    details.push(`protocol version probe failed (${errorMessage(e)})`);
  }
  return { id: "transport", status: ok ? "pass" : "fail", details };
}
