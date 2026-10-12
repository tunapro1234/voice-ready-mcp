#!/usr/bin/env node
import { main } from "./main.ts";

main(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
}).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`voice-ready-mcp: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  },
);
