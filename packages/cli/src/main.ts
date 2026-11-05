#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { BackendError } from "./api.ts";
import { runRepl } from "./repl.ts";

const USAGE = `Usage: edven-ai [options]

Options:
  --version   Print the version
  --help      Print this help

Environment:
  EDVEN_API_URL   Backend URL (default: http://127.0.0.1:8787)
`;

try {
  const { values } = parseArgs({
    options: { version: { type: "boolean" }, help: { type: "boolean" } },
  });
  if (values.help) {
    process.stdout.write(USAGE);
  } else if (values.version) {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    console.log(pkg.version);
  } else {
    await runRepl(process.env.EDVEN_API_URL || "http://127.0.0.1:8787");
  }
} catch (error) {
  if (error instanceof BackendError || (error as NodeJS.ErrnoException).code?.startsWith("ERR_PARSE_ARGS")) {
    console.error((error as Error).message);
    process.exit(1);
  }
  throw error;
}
