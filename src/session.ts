import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { VERSION } from "./version.ts";

export type McpSession = {
  client: Client;
  close(): Promise<void>;
};

/**
 * Opens a Streamable HTTP session. The client declares no capabilities, so it never
 * advertises elicitation: a tool that asks the user a question will hit the fallback path.
 */
export async function connect(url: string, headers: Record<string, string> = {}): Promise<McpSession> {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers },
  });
  const client = new Client({ name: "voice-ready-mcp", version: VERSION }, { capabilities: {} });
  await client.connect(transport);
  return {
    client,
    close: async () => {
      await client.close().catch(() => undefined);
    },
  };
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
