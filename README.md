# voice-ready-mcp

voice-ready-mcp checks whether a Model Context Protocol (MCP) server is ready for a voice assistant. It calls the server's tools with a fixed list of calls and reports four things: whether each reply can be read aloud, whether replies arrive inside a latency budget, whether the transport refuses requests it should refuse, and whether the MCP Apps views are served with the right MIME type. It prints a table, can write a JSON report, and exits with a code your CI can use. It does not test protocol correctness; for that, see the comparison below.

## Install

The package is not on the npm registry. Run it from the Git tag without installing:

```sh
npx github:tunapro1234/voice-ready-mcp#v0.1.0 --url http://127.0.0.1:3000/mcp --fixtures calls.json
```

Or add it to a project:

```sh
npm install github:tunapro1234/voice-ready-mcp#v0.1.0
npx voice-ready-mcp --help
```

The package builds itself on install (`prepare` runs `tsc`). It needs Node 22.12 or later.

## Usage

The server must listen on Streamable HTTP. Give the endpoint with `--url` and a JSON file of tool calls with `--fixtures`:

```json
[
  { "tool": "check_order_status", "arguments": { "orderId": "A-100" } },
  { "tool": "summarize_day", "arguments": {} }
]
```

| Flag | Meaning | Default |
| --- | --- | --- |
| `--url <url>` | Streamable HTTP endpoint (required) | none |
| `--fixtures <file>` | Tool calls to make (required) | none |
| `--json <file>` | Also write the report as JSON | none |
| `--header "Name: value"` | Extra request header, repeatable (for example `Authorization`) | none |
| `--budget-ms <n>` | Latency budget for p95, in milliseconds | 500 |
| `--max-chars <n>` | Longest allowed reply, in characters | 240 |
| `--runs <n>` | Timed calls per fixture | 50 |
| `--strict` | Fail, not warn, when p95 is over the budget | off |

Exit codes: `0` when no check fails, `1` when a check fails, `2` for a usage or fixture error.

Elicitation: the CLI's client declares no elicitation capability, so a server should not ask the user a question while it answers a fixture call. If a tool needs elicitation, call it with arguments that avoid the question, or leave it out of the fixtures file.

Headers you pass are sent with every request, including the two raw probes in the transport check. If your server answers those probes with 401, the transport check reports the 401 and fails.

## The four checks

1. **speakable.** The first text block of each reply must have no `|`, no Markdown (headings, lists, bold, code, links, quotes), no emoji, no raw URI or bare `www.` address, at most two sentences, and at most `--max-chars` characters. Sentences end at `.`, `!` or `?` followed by a space or the end of the text. An abbreviation such as "e.g. this" counts as a split.
2. **latency.** Each fixture is called `--runs` times on one session. The p50 and p95 are taken over all timed calls together and compared with `--budget-ms`. The numbers are whatever the run measured. A miss is a warning, or a failure with `--strict`.
3. **transport.** Two raw HTTP requests are sent to the endpoint. One has a foreign `Origin` and must get `403`. The other has an unsupported `MCP-Protocol-Version` and must get `400`.
4. **mcp-apps.** Every `_meta.ui.resourceUri` from `tools/list` is read with `resources/read`. Each must come back with `text/html;profile=mcp-app`.

## Example report

This is the output of one real run against the good fixture server in `test/fixtures/good-server.ts`, with `test/fixtures/good-calls.json` and default flags. Latency numbers change from run to run on your machine.

```
voice-ready-mcp report for http://127.0.0.1:40891/mcp

CHECK      STATUS  DETAILS
speakable  PASS    check_order_status: speakable
                   summarize_day: speakable
                   open_dashboard: speakable
latency    PASS    all calls: p50 2.5 ms, p95 3.7 ms, budget 500 ms
                   check_order_status: p50 2.6 ms, p95 3.8 ms over 50 runs
                   summarize_day: p50 2.4 ms, p95 3.3 ms over 50 runs
                   open_dashboard: p50 2.5 ms, p95 3.4 ms over 50 runs
transport  PASS    foreign Origin refused with 403
                   unsupported MCP-Protocol-Version refused with 400
mcp-apps   PASS    ui://voice-ready/dashboard (open_dashboard): text/html;profile=mcp-app

latency: p50 2.5 ms, p95 3.7 ms, budget 500 ms
result: ready (0 failed, 0 warned)
```

With `--json report.json`, the file has this shape:

```json
{
  "checks": [
    { "id": "speakable", "status": "pass", "details": ["check_order_status: speakable"] }
  ],
  "latency": { "p50": 2.5, "p95": 3.7, "budget": 500 },
  "target": "http://127.0.0.1:3000/mcp"
}
```

`status` is `pass`, `warn` or `fail`. `latency.p50` and `latency.p95` are `null` when no call was timed.

## Library API

```ts
import { runChecks } from "voice-ready-mcp";

const report = await runChecks({
  url: "http://127.0.0.1:3000/mcp",
  fixtures: [{ tool: "summarize_day", arguments: {} }],
  budgetMs: 500,
  maxChars: 240,
  runs: 20,
  strict: false,
});
console.log(report.checks.map((c) => `${c.id}: ${c.status}`));
```

`runChecks` returns a `Report` (`checks`, `latency`, `target`). It rejects with a `RangeError` for a non-positive budget, `maxChars` or `runs`. Connection failures do not reject: the affected checks come back as `fail`. The module also exports the text rules (`speakableProblems`, `countSentences`, `findMarkdown`, `findEmoji`, `findRawUris`, `findPipes`), `percentile`, `parseFixtures` and the individual checks.

## How this differs from @modelcontextprotocol/conformance

@modelcontextprotocol/conformance tests protocol correctness: whether a server speaks the spec. voice-ready-mcp assumes a server is already spec-correct and tests the voice experience around it. It asks whether a reply can be spoken, whether it arrives inside a latency budget, whether the transport refuses foreign origins and unsupported versions, and whether MCP Apps views carry the MIME type a host needs. Run both: conformance first, then this.

## Prior-art search

Date of search: 2026-10-12.

Queries, run on the web: "voice mcp lint speakable reply latency budget check npm"; "mcp speakable voice check github model context protocol voice assistant lint"; ""mcp" "latency budget" voice tool response checker npm package"; "npm search voice-ready mcp conformance MCP Apps text/html;profile=mcp-app checker". Registry searches on npm: "speakable mcp", "voice mcp lint", "mcp latency".

Result: not found. No package or tool I saw checks whether MCP tool replies are speakable, or applies a latency budget to MCP tool calls for voice use. Places looked: npm search results, GitHub and directory listings of voice MCP servers (for example speak2me-mcp, VoiceMode, Speech MCP Server), and MCP testing guides.

Adjacent tools that do something else:
- [mcp-compliance](https://www.getdrio.com/mcp/io-github-yawlabs-mcp-compliance/md) and [mcp-protocol-conformance](https://www.getdrio.com/mcp/io-studiomeyer-protocol-conformance/md): spec compliance, not voice.
- MCP Inspector, with an apps conformance check that reads `_meta.ui.resourceUri` and the HTML MIME type: an interactive inspector, not a CI gate with a latency budget.
- Per-tool latency budgets in MCP test suites, such as the [sunpeak.ai testing guide](https://sunpeak.ai/blogs/performance-testing-mcp-apps): patterns for a test file, not a published package.

## Development

```sh
npm ci --legacy-peer-deps
npm test
npm run build
```

`--legacy-peer-deps` is needed because npm 10 fails to resolve the optional peer dependencies of `vitest` 5.0.3 without it. Tests start real Streamable HTTP servers on `127.0.0.1` with ephemeral ports.

## License

MIT. See [LICENSE](LICENSE).
