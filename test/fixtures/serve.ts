// Test helper: serves an MCP server over Streamable HTTP on 127.0.0.1 with an ephemeral port.
// The guards are what separate the good fixture from the bad one: they refuse foreign
// Origins and unsupported MCP-Protocol-Version headers before the SDK sees the request.
import http from "node:http";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SUPPORTED_PROTOCOL_VERSIONS, isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

export type ServeOptions = {
  makeServer: () => Server;
  /** true: refuse foreign Origins (403) and unsupported protocol versions (400). */
  guards: boolean;
};

export type TestServer = { url: string; close(): Promise<void> };

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
}

export async function serveMcp(options: ServeOptions): Promise<TestServer> {
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const handle = async (req: http.IncomingMessage, res: http.ServerResponse, port: number): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname !== "/mcp") return sendJson(res, 404, { error: "Not found" });

    if (options.guards) {
      const origin = req.headers.origin;
      const own = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
      if (origin !== undefined && !own.includes(origin)) return sendJson(res, 403, { error: "Origin not allowed" });
      const version = req.headers["mcp-protocol-version"];
      if (typeof version === "string" && !SUPPORTED_PROTOCOL_VERSIONS.includes(version)) {
        return sendJson(res, 400, { jsonrpc: "2.0", error: { code: -32000, message: `Unsupported MCP-Protocol-Version: ${version}` }, id: null });
      }
    } else {
      // The bad fixture does not look at the version header at all.
      delete req.headers["mcp-protocol-version"];
    }

    let body: unknown;
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const text = Buffer.concat(chunks).toString("utf8");
      body = text ? JSON.parse(text) : undefined;
    }

    const sid = req.headers["mcp-session-id"];
    if (typeof sid === "string") {
      const transport = sessions.get(sid);
      if (!transport) return sendJson(res, 404, { error: "Session not found" });
      return transport.handleRequest(req, res, body);
    }
    if (req.method === "POST" && isInitializeRequest(body)) {
      const server = options.makeServer();
      const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id: string): void => {
          sessions.set(id, transport);
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };
      await server.connect(transport);
      return transport.handleRequest(req, res, body);
    }
    return sendJson(res, 400, { error: "No valid session. Send initialize first." });
  };

  const httpServer = http.createServer((req, res) => {
    const port = (httpServer.address() as AddressInfo).port;
    handle(req, res, port).catch((e: unknown) => {
      if (!res.headersSent) sendJson(res, 500, { error: String(e) });
      else res.end();
    });
  });
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = httpServer.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    close: async () => {
      for (const t of sessions.values()) await t.close().catch(() => undefined);
      sessions.clear();
      await new Promise<void>((resolve) => {
        httpServer.closeAllConnections();
        httpServer.close(() => resolve());
      });
    },
  };
}
