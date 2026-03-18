#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { initCommand } from "./commands/init";
import { listCommand } from "./commands/list";
import { runCommand } from "./commands/run";
import { updateCommand } from "./commands/update";
import { currentVersion } from "./version";

function showHelp(): void {
  console.log(`otto — autonomous AI coding agent

Usage:
  otto run [workflow]   Run a workflow (default if omitted)
  otto init             Scaffold .otto/ directory
  otto list             List available workflows
  otto update           Update otto to the latest version

Options for 'run':
  -n, --max-iterations <n>   Max iterations (0 = unlimited)
  --delay <seconds>          Delay between iterations
  --stop-on-error            Stop on non-zero agent exit
  --report-back              Relay iteration events to parent otto process
                             (auto-enabled when OTTO_CHILD_EVENTS_PATH is set)

Global options:
  -v, --version              Print version and exit
  -h, --help                 Show this help message
`);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "max-iterations": { type: "string", short: "n" },
      delay: { type: "string" },
      "stop-on-error": { type: "boolean", default: false },
      "report-back": { type: "boolean", default: false },
      version: { type: "boolean", short: "v" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.version) {
    console.log(currentVersion);
    process.exit(0);
  }

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
        reportBack: values["report-back"],
      });
      break;
    }

    case "update":
      await updateCommand();
      break;

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
