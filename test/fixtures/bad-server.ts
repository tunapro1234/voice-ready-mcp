// A server that fails every check on purpose: Markdown, an emoji and a long reply, a slow tool,
// no Origin or protocol-version guards, and a dashboard served as text/html without the MCP Apps type.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { serveMcp, type TestServer } from "./serve.ts";

export const DASHBOARD_URI = "ui://voice-ready/dashboard";

const TOOLS = [
  {
    name: "markdown_reply",
    description: "Replies with a table, links and emoji.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "slow_reply",
    description: "Replies after a configurable delay.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "open_dashboard",
    description: "Opens the dashboard view.",
    inputSchema: { type: "object", properties: {} },
    _meta: { ui: { resourceUri: DASHBOARD_URI } },
  },
];

const LONG_MARKDOWN =
  "**Order shipped** | see https://example.com/track/123 \u{1F69A}\n\n" +
  "- Arrives Tuesday. Sign for it at the door. Keep the receipt in case you need to return the item.\n" +
  "- Check the tracking page for updates every morning. Call the store if the parcel is late.\n" +
  "- Thanks for waiting. We hope you enjoy it. Reply to this message if anything looks wrong.";

export function makeBadServer(delayMs: number): Server {
  const server = new Server(
    { name: "bad-voice-server", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name === "markdown_reply") return { content: [{ type: "text", text: LONG_MARKDOWN }] };
    if (req.params.name === "slow_reply") {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return { content: [{ type: "text", text: "Done. Your list is saved." }] };
    }
    if (req.params.name === "open_dashboard") return { content: [{ type: "text", text: "Dashboard opened." }] };
    throw new Error(`Unknown tool ${req.params.name}`);
  });
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [{ uri: DASHBOARD_URI, name: "dashboard", mimeType: "text/html" }],
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async () => ({
    contents: [{ uri: DASHBOARD_URI, mimeType: "text/html", text: "<!doctype html><html><body>Tasks</body></html>" }],
  }));
  return server;
}

export function startBadServer(delayMs = 0): Promise<TestServer> {
  return serveMcp({ makeServer: () => makeBadServer(delayMs), guards: false });
}
