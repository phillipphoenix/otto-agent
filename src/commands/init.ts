import { join } from "node:path";
import { mkdir } from "node:fs/promises";

const DEFAULT_CONFIG = {
  agent: {
    command: "claude",
    args: ["-p", "--dangerously-skip-permissions"],
    model: "sonnet",
    denyList: [".env", "**/.env", "*.pem", "*.key"],
  },
  defaults: {
    workflow: "default",
    maxIterations: 0,
    delay: 0,
    timeout: null,
    stopOnError: false,
    logDir: null,
  },
};

const DEFAULT_WORKFLOW = `---
description: Default workflow
---
You are an autonomous coding agent. Complete one meaningful task per iteration.

## Context

{{ contexts }}

## Instructions

{{ instructions }}

## Task

Look at the codebase, identify the next useful improvement, implement it, and commit your changes.
If previous check failures are listed below, fix those first.
`;

const DEFAULT_CONTEXT = `---
description: Recent git history
command: git log --oneline -20
---
`;

const DEFAULT_INSTRUCTION = `---
description: Coding standards
---
- Write clean, readable code with meaningful names.
- Add comments only when the "why" is not obvious from the code.
- Keep functions small and focused on a single responsibility.
- Handle errors gracefully; never swallow exceptions silently.
`;

const DEFAULT_CHECK = `---
description: TypeScript type check
command: bun tsc --noEmit
timeout: 60
---
`;

interface ScaffoldFile {
  path: string;
  content: string;
}

export async function initCommand(projectDir: string): Promise<void> {
  const base = join(projectDir, ".otto");

  const dirs = [
    base,
    join(base, "workflows", "default"),
    join(base, "contexts", "git-history"),
    join(base, "instructions", "coding-standards"),
    join(base, "checks", "typecheck"),
  ];

  const files: ScaffoldFile[] = [
    { path: join(base, "otto.json"), content: JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n" },
    { path: join(base, "workflows", "default", "WORKFLOW.md"), content: DEFAULT_WORKFLOW },
    { path: join(base, "contexts", "git-history", "CONTEXT.md"), content: DEFAULT_CONTEXT },
    { path: join(base, "instructions", "coding-standards", "INSTRUCTION.md"), content: DEFAULT_INSTRUCTION },
    { path: join(base, "checks", "typecheck", "CHECK.md"), content: DEFAULT_CHECK },
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }

  for (const { path, content } of files) {
    await Bun.write(path, content);
    console.log(`  created ${path.replace(projectDir + "/", "")}`);
  }

  console.log("\n.otto/ initialized. Run `otto list` to see workflows.");
}
