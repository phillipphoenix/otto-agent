#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { initCommand } from "./commands/init";
import { listCommand } from "./commands/list";
import { runCommand } from "./commands/run";

function showHelp(): void {
  console.log(`otto — autonomous AI coding agent

Usage:
  otto run [workflow]   Run a workflow (default if omitted)
  otto init             Scaffold .otto/ directory
  otto list             List available workflows

Options for 'run':
  -n, --max-iterations <n>   Max iterations (0 = unlimited)
  --delay <seconds>          Delay between iterations
  --stop-on-error            Stop on non-zero agent exit
`);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "max-iterations": { type: "string", short: "n" },
      delay: { type: "string" },
      "stop-on-error": { type: "boolean", default: false },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help || positionals.length === 0) {
    showHelp();
    process.exit(positionals.length === 0 && !values.help ? 1 : 0);
  }

  const command = positionals[0];
  const projectDir = process.cwd();

  switch (command) {
    case "init":
      await initCommand(projectDir);
      break;

    case "list":
      await listCommand(projectDir);
      break;

    case "run": {
      const workflowName = positionals[1];
      const maxIterations = values["max-iterations"]
        ? Number(values["max-iterations"])
        : undefined;
      const delay = values.delay ? Number(values.delay) : undefined;

      await runCommand(projectDir, workflowName, {
        maxIterations,
        delay,
        stopOnError: values["stop-on-error"],
      });
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
