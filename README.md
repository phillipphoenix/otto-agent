<p align="center">
  <h1 align="center">Otto Agent</h1>
  <p align="center">Autonomous coding agent that runs in a loop until the job is done.</p>
</p>

---

Inspired heavily by [ralphify](https://github.com/computerlovetech/ralphify) (almost just a port to Typescript) - Otto Agent wraps [Claude Code](https://docs.anthropic.com/en/docs/claude-code) in a configurable loop with contexts, instructions, and self-healing checks. Each iteration gets a fresh prompt built from your primitives, runs the agent, validates the output, and feeds failures back into the next round.

# Install

**Linux / macOS:**

```bash
curl -fsSL https://raw.githubusercontent.com/phillipphoenix/otto-agent/main/install.sh | sh
```

**Windows (PowerShell):**

```powershell
irm https://raw.githubusercontent.com/phillipphoenix/otto-agent/main/install.ps1 | iex
```

You can also set a specific version:

```bash
VERSION=v1.0.0 curl -fsSL https://raw.githubusercontent.com/phillipphoenix/otto-agent/main/install.sh | sh
```

# Quickstart

```bash
otto init         # scaffold .otto/ config directory
otto run          # start the default workflow
```

# How it works

Otto runs Claude Code in an autonomous loop. Each iteration:

1. **Contexts** are gathered (shell commands run, static text loaded)
2. **Instructions** are injected as guidelines
3. A **prompt** is assembled from your workflow template
4. The **agent** runs with that prompt
5. **Checks** validate the result — failures feed back into the next iteration's prompt

The prompt is the tuning knob. Change what contexts, instructions, and checks are active and you change what the agent sees and how it's validated.

## What `otto init` creates

```
.otto/
├── otto.json                                  # agent & run config
├── workflows/
│   └── default/
│       └── WORKFLOW.md                        # prompt template
├── contexts/
│   └── git-history/
│       └── CONTEXT.md                         # dynamic: `git log --oneline -20`
├── instructions/
│   └── coding-standards/
│       └── INSTRUCTION.md                     # static coding rules
└── checks/
    └── typecheck/
        └── CHECK.md                           # `bun tsc --noEmit`
```

**otto.json** — configure the agent command, model, and run defaults:

```json
{
  "agent": {
    "command": "claude",
    "args": ["-p", "--dangerously-skip-permissions"],
    "model": "sonnet"
  },
  "defaults": {
    "workflow": "default",
    "maxIterations": 0,
    "delay": 0,
    "timeout": null,
    "stopOnError": false,
    "logDir": null
  }
}
```

`defaults.timeout` — per-iteration agent timeout in **milliseconds** (`null` = no timeout). `defaults.delay` — seconds to wait between iterations.

## What `otto run` does

```
┌─────────────────────────────────────────────┐
│  discover contexts → run commands, collect  │
│  discover instructions → load static text   │
│  resolve WORKFLOW.md template               │
│  ↓                                          │
│  spawn agent with built prompt              │
│  ↓                                          │
│  run checks → pass? → next iteration        │
│              fail? → feed errors back ──┐   │
│                                         │   │
│  ◄──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

The loop continues until the agent signals completion (`%%OTTO_STOP%%`), hits `--max-iterations`, or you press Ctrl+C. Each iteration starts with fresh context — progress lives in git, not in the agent's memory.

## What it looks like

```
otto run default

────────────────────────────────────────────────────────────
Iteration 1                                        ✓ passed
  ▸ Read src/cli.ts
  ▸ Edit src/cli.ts
  Added --verbose flag to CLI
  ✓ typecheck

────────────────────────────────────────────────────────────
Iteration 2                                        ✗ failed
  ▸ Edit src/engine.ts
  Refactored loop to support verbose logging
  ✗ typecheck

────────────────────────────────────────────────────────────
Iteration 3                                        ✓ passed
  ▸ Edit src/engine.ts
  Fixed type error from previous iteration
  ✓ typecheck

Done: 3 iteration(s) — 2 succeeded, 1 failed (42s)
```

## Primitives

Otto has three building blocks. Each is a directory under `.otto/` containing a markdown file with optional YAML frontmatter.

### Contexts

Dynamic data injected into the prompt. If `command` is set, otto runs it and captures stdout. Otherwise the body text is used directly.

```markdown
---
description: Recent git history
command: git log --oneline -20
---
```

### Instructions

Static reusable rules. No command — just markdown body text included in the prompt.

```markdown
---
description: Coding standards
---
- Write clean, readable code with meaningful names.
- Keep functions small and focused.
- Handle errors gracefully.
```

### Checks

Post-iteration validation. Must have a `command`. Exit 0 = pass, nonzero = fail. Failures are collected and injected into the next iteration's prompt so the agent can self-heal. `timeout` is in seconds.

```markdown
---
description: TypeScript type check
command: bun tsc --noEmit
timeout: 60
---
```

All three types support `enabled: false` in frontmatter to disable without deleting.

Primitives can live globally (`.otto/contexts/`, `.otto/instructions/`, `.otto/checks/`) or scoped to a workflow (`.otto/workflows/{name}/contexts/`, etc.). Workflow-scoped primitives override global ones by name.

## Workflows

A workflow is a named prompt template in `.otto/workflows/{name}/WORKFLOW.md`. Use `{{ contexts }}` and `{{ instructions }}` placeholders to control where primitives are injected.

```markdown
---
description: Default workflow
---
You are an autonomous coding agent. Complete one meaningful task per iteration.

## Context

{{ contexts }}

## Instructions

{{ instructions }}

## Task

Look at the codebase, identify the next useful improvement, implement it,
and commit your changes. If previous check failures are listed below,
fix those first.
```

**Frontmatter options:**
- `description` — shown by `otto list`
- `enabled` — set to `false` to hide from `otto list` without deleting
- `completable` — set to `true` to automatically append stop instructions and enable `%%OTTO_STOP%%` signalling
- `model` — override the model for this workflow (e.g. `opus`, `haiku`); falls back to `otto.json` agent config

**Placeholders:**
- `{{ contexts }}` — all contexts (alphabetical)
- `{{ contexts.git-history }}` — a specific context by name
- `{{ instructions }}` — all instructions
- `{{ instructions.coding-standards }}` — a specific instruction by name

If no placeholders are present, all contexts and instructions are appended automatically.

# CLI Commands

## `otto run [workflow]`

Run a workflow (defaults to the one set in `otto.json`).

| Flag | Description |
|------|-------------|
| `-n, --max-iterations <n>` | Max iterations (0 = unlimited) |
| `--delay <seconds>` | Delay between iterations |
| `--stop-on-error` | Stop on non-zero agent exit |
| `--report-back` | Relay iteration events to a parent otto process (auto-enabled when `OTTO_CHILD_EVENTS_PATH` is set) |

## `otto init`

Scaffold the `.otto/` directory with a default workflow, context, instruction, and check.

## `otto list`

List available workflows with their descriptions.

## `otto update`

Update otto to the latest version.

# Requirements

- [Bun](https://bun.sh)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`claude` command available in PATH)

# Developing on Otto Agent

## Install

```bash
bun install
```

## Run locally

```bash
bun run otto <command>   # e.g. bun run otto run
```

## Test

```bash
bun test
```

# License

MIT
