// A voice-ready MCP server used as the passing fixture. Every reply is short plain text,
// the transport guards are on, and the dashboard view is served with the MCP Apps MIME type.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { serveMcp, type TestServer } from "./serve.ts";

export const DASHBOARD_URI = "ui://voice-ready/dashboard";
export const APP_MIME = "text/html;profile=mcp-app";

const TOOLS = [
  {
    name: "check_order_status",
    description: "Says where an order is.",
    inputSchema: { type: "object", properties: { orderId: { type: "string" } } },
  },
  {
    name: "summarize_day",
    description: "Summarizes today in two sentences.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "open_dashboard",
    description: "Opens the dashboard view.",
    inputSchema: { type: "object", properties: {} },
    _meta: { ui: { resourceUri: DASHBOARD_URI } },
  },
];

const REPLIES: Record<string, string> = {
  check_order_status: "Your order has shipped and arrives on Tuesday.",
  summarize_day: "You have three meetings today. The first starts at nine.",
  open_dashboard: "The dashboard is open. It shows three open tasks.",
};

export function makeGoodServer(): Server {
  const server = new Server(
    { name: "good-voice-server", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const reply = REPLIES[req.params.name];
    if (!reply) throw new Error(`Unknown tool ${req.params.name}`);
    return { content: [{ type: "text", text: reply }] };
  });
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [{ uri: DASHBOARD_URI, name: "dashboard", mimeType: APP_MIME }],
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    if (req.params.uri !== DASHBOARD_URI) throw new Error(`Unknown resource ${req.params.uri}`);
    return {
      contents: [{ uri: DASHBOARD_URI, mimeType: APP_MIME, text: "<!doctype html><html><body><h1>Tasks</h1></body></html>" }],
    };
  });
  return server;
}

export function startGoodServer(): Promise<TestServer> {
  return serveMcp({ makeServer: makeGoodServer, guards: true });
}
