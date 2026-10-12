import type { CheckResult } from "../types.ts";
import type { McpSession } from "../session.ts";
import { errorMessage } from "../session.ts";

export const MCP_APP_MIME = "text/html;profile=mcp-app";

/** Reads `_meta.ui.resourceUri` from a tool definition, or returns undefined. */
export function resourceUriOf(tool: unknown): string | undefined {
  const meta = (tool as { _meta?: { ui?: { resourceUri?: unknown } } })._meta;
  const uri = meta?.ui?.resourceUri;
  return typeof uri === "string" && uri !== "" ? uri : undefined;
}

/** Every tool that declares a view must have that view read back as an MCP App page. */
export async function checkMcpApps(session: McpSession): Promise<CheckResult> {
  const { tools } = await session.client.listTools();
  const uris = new Map<string, string[]>();
  for (const tool of tools) {
    const uri = resourceUriOf(tool);
    if (uri) uris.set(uri, [...(uris.get(uri) ?? []), tool.name]);
  }
  if (uris.size === 0) {
    return { id: "mcp-apps", status: "warn", details: ["no tool declares _meta.ui.resourceUri, nothing was checked"] };
  }
  const details: string[] = [];
  let ok = true;
  for (const [uri, owners] of uris) {
    try {
      const { contents } = await session.client.readResource({ uri });
      const mime = contents[0]?.mimeType;
      if (mime === MCP_APP_MIME) {
        details.push(`${uri} (${owners.join(", ")}): ${MCP_APP_MIME}`);
      } else {
        ok = false;
        details.push(`${uri} (${owners.join(", ")}): expected ${MCP_APP_MIME}, got ${mime ?? "no mimeType"}`);
      }
    } catch (e) {
      ok = false;
      details.push(`${uri} (${owners.join(", ")}): read failed (${errorMessage(e)})`);
    }
  }
  return { id: "mcp-apps", status: ok ? "pass" : "fail", details };
}
